<script lang="ts">
  import { _ } from "svelte-i18n";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import {
    AUTO_LANGUAGE,
    LANGUAGES,
    findLanguage,
  } from "$lib/constants/languages";

  let {
    sourceLang = $bindable(),
    targetLang = $bindable(),
    model = $bindable(),
    availableModels,
    hasActiveProvider,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hasApiKey,
    isLoading,
    canTranslate,
    ontranslate,
    oncancel,
  }: {
    sourceLang: string;
    targetLang: string;
    model: string;
    availableModels: string[];
    hasActiveProvider: boolean;
    hasApiKey: boolean;
    isLoading: boolean;
    canTranslate: boolean;
    ontranslate: () => void;
    oncancel: () => void;
  } = $props();

  const allLanguages = [AUTO_LANGUAGE, ...LANGUAGES];
  const modelDisabled = $derived(
    !hasActiveProvider || availableModels.length === 0,
  );
  const modelTriggerLabel = $derived(modelDisabled ? "—" : model || "—");
  const labelClass = "text-xs text-gray-500 dark:text-gray-400 font-normal";
</script>

<div
  data-testid="translate-controls"
  class="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
>
  <div class="flex flex-col gap-1">
    <Label for="source-lang" class={labelClass}>
      {$_("translate_page.label_source_lang")}
    </Label>
    <Select.Root type="single" bind:value={sourceLang}>
      <Select.Trigger
        id="source-lang"
        data-testid="source-lang-select"
        class="w-44"
      >
        {findLanguage(sourceLang)?.name ?? sourceLang}
      </Select.Trigger>
      <Select.Content>
        {#each allLanguages as lang (lang.code)}
          <Select.Item value={lang.code} label={lang.name}
            >{lang.name}</Select.Item
          >
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <div class="flex items-center pb-2">
    <svg
      class="w-5 h-5 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M14 5l7 7m0 0l-7 7m7-7H3"
      />
    </svg>
  </div>

  <div class="flex flex-col gap-1">
    <Label for="target-lang" class={labelClass}>
      {$_("translate_page.label_target_lang")}
    </Label>
    <Select.Root type="single" bind:value={targetLang}>
      <Select.Trigger
        id="target-lang"
        data-testid="target-lang-select"
        class="w-44"
      >
        {findLanguage(targetLang)?.name ?? targetLang}
      </Select.Trigger>
      <Select.Content>
        {#each LANGUAGES as lang (lang.code)}
          <Select.Item value={lang.code} label={lang.name}
            >{lang.name}</Select.Item
          >
        {/each}
      </Select.Content>
    </Select.Root>
  </div>

  <div class="flex flex-col gap-1">
    <Label for="model-select" class={labelClass}>
      {$_("translate_page.label_model")}
    </Label>
    <Select.Root type="single" bind:value={model}>
      <Select.Trigger
        id="model-select"
        data-testid="model-select"
        class="w-48"
        disabled={modelDisabled}
      >
        {modelTriggerLabel}
      </Select.Trigger>
      {#if !modelDisabled}
        <Select.Content>
          {#each availableModels as m (m)}
            <Select.Item value={m} label={m}>{m}</Select.Item>
          {/each}
        </Select.Content>
      {/if}
    </Select.Root>
  </div>

  <div class="flex items-end gap-2 ml-auto">
    {#if isLoading}
      <Button
        type="button"
        data-testid="cancel-button"
        variant="destructive"
        onclick={oncancel}
      >
        {$_("translate_page.button_cancel")}
      </Button>
    {/if}
    <Button
      type="button"
      data-testid="translate-button"
      onclick={ontranslate}
      disabled={!canTranslate}
    >
      {isLoading
        ? $_("translate_page.translating")
        : $_("translate_page.button_translate")}
    </Button>
  </div>
</div>
