<script lang="ts">
  import { settingsStore } from "$lib/stores/settings";
  import { glossaryStore } from "$lib/stores/glossary";
  import { addHistoryEntry } from "$lib/stores/history";
  import { toast } from "svelte-sonner";
  import { getProviderById } from "$lib/providers/registry";
  import { _ } from "svelte-i18n";
  import { getErrorMessage } from "$lib/constants/error-messages";
  import { translateAction } from "$lib/streaming/translateAction";
  import { detectLanguage } from "$lib/detect/detectLanguage";
  import { languageName } from "$lib/constants/languages";
  import type {
    TranslationRequest,
    TranslationHistoryEntry,
  } from "$lib/schemas";
  import TranslateControls from "$lib/components/TranslateControls.svelte";
  import AdvancedOptions from "$lib/components/AdvancedOptions.svelte";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import {
    extractTextFromFile,
    UnsupportedFileTypeError,
  } from "$lib/file/extractText";
  import { openSettings } from "$lib/stores/ui";

  function handleToggleGlossary(): void {
    glossaryStore.update((g) => ({ ...g, enabled: !g.enabled }));
  }

  let sourceText = $state("");
  let sourceLang = $state("auto");
  let targetLang = $state("ko");
  let model = $state("");
  let customPrompt = $state("");
  let cleanSourceText = $state(false);
  let isLoading = $state(false);
  let resultText = $state("");
  let advancedExpanded = $state(false);
  let loadedFile = $state<{ name: string; content: string } | null>(null);

  let settings = $derived($settingsStore);
  let glossary = $derived($glossaryStore);

  let activeProviderConfig = $derived(
    settings.providers.find((p) => p.providerId === settings.activeProviderId),
  );

  let hasActiveProvider = $derived(settings.activeProviderId !== null);
  let hasApiKey = $derived((activeProviderConfig?.apiKey ?? "").trim() !== "");

  let activeProvider = $derived(
    settings.activeProviderId
      ? getProviderById(settings, settings.activeProviderId)
      : undefined,
  );

  let availableModels = $derived(activeProvider?.models ?? []);

  let effectiveSourceText = $derived(loadedFile?.content ?? sourceText);

  let canTranslate = $derived(
    effectiveSourceText.trim() !== "" &&
      hasApiKey &&
      hasActiveProvider &&
      !isLoading,
  );

  let charCount = $derived(effectiveSourceText.length);

  // Detect language when sourceLang is 'auto' and effective source text is present
  let detectedLanguage = $derived(
    sourceLang === "auto" && effectiveSourceText.trim() !== ""
      ? detectLanguage(effectiveSourceText)
      : "",
  );

  // Sync local model state when the active provider or its config changes.
  let prevProviderId: string | null = null;
  $effect(() => {
    const pid = settings.activeProviderId;
    if (pid !== prevProviderId) {
      prevProviderId = pid;
      model =
        activeProviderConfig?.selectedModel ??
        activeProvider?.defaultModel ??
        "";
    }
  });

  let abortController: AbortController | null = null;

  async function handleTranslate(): Promise<void> {
    if (!canTranslate) return;

    isLoading = true;
    resultText = "";

    abortController = new AbortController();

    const providerName =
      activeProvider?.name ?? settings.activeProviderId ?? "";
    const modelName = model || activeProviderConfig?.selectedModel || "";

    const request: TranslationRequest = {
      sourceText: effectiveSourceText,
      sourceLang: sourceLang,
      targetLang,
      providerId: settings.activeProviderId ?? "",
      apiKey: activeProviderConfig?.apiKey ?? "",
      model: modelName,
      glossary: glossary.enabled ? glossary : undefined,
      customPrompt: customPrompt.trim() || undefined,
      cleanSourceText: cleanSourceText || undefined,
    };

    await translateAction(
      request,
      {
        onChunk: (_text, accumulated) => {
          resultText = accumulated;
        },
        onError: (error) => {
          // Surface the failure as a transient toast keyed off the error
          // code (friendly Korean mapping). Any partial result already
          // rendered in `resultText` is intentionally kept so the user
          // does not lose what streamed before the error.
          toast.error(getErrorMessage(error), { duration: 10000 });
        },
        onDone: (fullText) => {
          if (fullText === "") return;
          const entry: TranslationHistoryEntry = {
            id: crypto.randomUUID(),
            request,
            response: fullText,
            providerName,
            modelName,
            createdAt: new Date().toISOString(),
          };
          addHistoryEntry(entry);
        },
      },
      abortController.signal,
    );

    isLoading = false;
    abortController = null;
  }

  function handleCancel(): void {
    abortController?.abort();
  }

  async function handleFileUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const content = await extractTextFromFile(file);
      if (content.trim() === "") {
        toast.error($_("errors.PDF_NO_TEXT"), { duration: 10000 });
        input.value = "";
        return;
      }
      loadedFile = { name: file.name, content };
      sourceText = "";
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) {
        toast.error($_("errors.INVALID_FILE_TYPE"), { duration: 10000 });
      } else {
        toast.error($_("errors.PDF_EXTRACTION_FAILED"), { duration: 10000 });
      }
      input.value = "";
    }
  }

  function handleRemoveFile(): void {
    loadedFile = null;
  }

  function handleTextareaInput(): void {
    loadedFile = null;
  }
</script>

<svelte:head>
  <title>{$_("app.title")}</title>
</svelte:head>

<div class="flex flex-col gap-4 py-4">
  <TranslateControls
    bind:sourceLang
    bind:targetLang
    bind:model
    {availableModels}
    {hasActiveProvider}
    {hasApiKey}
    {isLoading}
    {canTranslate}
    ontranslate={handleTranslate}
    oncancel={handleCancel}
  />

  {#if !hasApiKey}
    <div
      data-testid="no-api-key-warning"
      class="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-md px-4 py-2"
    >
      <span class="text-sm text-destructive">
        {hasActiveProvider
          ? $_("errors.NO_API_KEY")
          : $_("errors.NO_ACTIVE_PROVIDER")}
      </span>
      <button
        type="button"
        data-testid="warning-open-settings"
        onclick={openSettings}
        class="text-sm text-primary hover:underline font-medium whitespace-nowrap"
      >
        {$_("translate_page.link_to_settings")}
      </button>
    </div>
  {/if}

  {#if sourceLang === "auto" && detectedLanguage}
    <div
      data-testid="detected-language"
      class="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-4 py-2"
    >
      <span class="text-sm text-primary">
        {$_("translate_page.detected_language", {
          values: { name: languageName(detectedLanguage) },
        })}
      </span>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2" style="min-height: 320px;">
    <div class="flex flex-col gap-1">
      {#if loadedFile}
        <div
          data-testid="loaded-file-chip"
          class="flex items-center gap-2 px-3 py-2 rounded-md bg-accent border border-border"
        >
          <svg
            class="w-5 h-5 text-primary flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span class="text-sm text-accent-foreground font-medium truncate">
            {loadedFile.name}
          </span>
          <button
            type="button"
            data-testid="remove-file-button"
            onclick={handleRemoveFile}
            aria-label={$_("translate_page.button_upload")}
            class="ml-auto text-muted-foreground hover:text-destructive transition flex-shrink-0"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      {/if}
      <Textarea
        data-testid="source-textarea"
        placeholder={$_("translate_page.placeholder_source")}
        bind:value={sourceText}
        oninput={handleTextareaInput}
        class="min-h-[300px] h-full resize-none"
      />
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <label
            data-testid="file-upload-label"
            for="file-upload"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground transition cursor-pointer"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {$_("translate_page.button_upload")}
          </label>
          <input
            id="file-upload"
            data-testid="file-upload-input"
            type="file"
            accept=".txt,.pdf,text/plain,application/pdf"
            class="hidden"
            onchange={handleFileUpload}
          />
        </div>
        <span class="text-xs text-muted-foreground">
          {$_("translate_page.char_count", { values: { n: charCount } })}
        </span>
      </div>
    </div>

    <div
      data-testid="result-area"
      class="px-4 py-3 rounded-lg border border-border bg-muted overflow-y-auto"
      style="min-height: 300px;"
    >
      {#if resultText}
        <p
          data-testid="result-text"
          class="text-sm text-foreground whitespace-pre-wrap"
        >
          {resultText}
        </p>
      {/if}
      {#if !resultText}
        <p
          data-testid="result-placeholder"
          class="text-sm text-muted-foreground"
        >
          {$_("translate_page.placeholder_result")}
        </p>
      {/if}
    </div>
  </div>

  <AdvancedOptions
    bind:expanded={advancedExpanded}
    bind:customPrompt
    bind:cleanSourceText
    glossaryEnabled={glossary.enabled}
    glossaryCount={glossary.entries.length}
    onToggleGlossary={handleToggleGlossary}
  />
</div>
