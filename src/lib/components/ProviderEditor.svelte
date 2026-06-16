<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { Provider, ProviderConfig } from "$lib/schemas";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";

  let {
    mode,
    provider,
    config,
    unconfiguredPresets,
    onsave,
    ondelete,
    oncancel,
  }: {
    mode: "edit" | "new";
    provider: Provider | undefined;
    config: ProviderConfig | undefined;
    unconfiguredPresets: Provider[];
    onsave: (config: ProviderConfig, isNew: boolean) => void;
    ondelete?: (providerId: string) => void;
    oncancel: () => void;
  } = $props();

  // Picker choice in 'new' mode: which sub-form to show.
  let pickerChoice = $state<"preset" | "custom" | "openai-compat" | null>(null);

  // Shared form state. Re-seeded whenever the form key (mode + provider id +
  // picker choice) changes, mirroring the old AddProviderModal/EditProviderDrawer
  // $effect/untrack patterns so editing different providers re-initializes.
  let apiKey = $state("");
  let selectedModel = $state("");
  let pickedPresetId = $state("");
  let name = $state("");
  let baseURL = $state("");
  let modelsInput = $state("");
  let defaultModel = $state("");

  let models = $derived(
    modelsInput
      .split(",")
      .map((m) => m.trim())
      .filter((m) => m !== ""),
  );

  let pickedPreset = $derived(
    pickedPresetId
      ? (unconfiguredPresets.find((p) => p.id === pickedPresetId) ?? undefined)
      : undefined,
  );

  // The entry key determines when local form state must be re-seeded. It
  // captures the form context (mode + which provider), NOT the picker choice.
  // On every context change we reset the picker (new mode) and re-seed fields,
  // mirroring the old AddProviderModal/EditProviderDrawer $effect/untrack
  // patterns so editing different providers re-initializes the form.
  let lastEntryKey = $state("");
  $effect(() => {
    const entryKey = `${mode}:${provider?.id ?? ""}`;
    if (entryKey === lastEntryKey) return;
    lastEntryKey = entryKey;
    pickerChoice = null;
    seedFields();
  });

  function seedFields(): void {
    if (mode === "edit" && provider) {
      apiKey = config?.apiKey ?? "";
      selectedModel = config?.selectedModel ?? provider.defaultModel;
      name = provider.name;
      baseURL = provider.baseURL;
      modelsInput = provider.models.join(", ");
      defaultModel = provider.defaultModel;
      pickedPresetId = "";
    } else if (mode === "new") {
      apiKey = "";
      selectedModel = "";
      name = "";
      baseURL = "";
      modelsInput = "";
      defaultModel = "";
      pickedPresetId = "";
    }
  }

  // Keep defaultModel in sync with the parsed models list (mirrors old
  // AddProviderModal lastModelsKey pattern).
  let lastModelsKey = $state("");
  $effect(() => {
    const key = models.join("|");
    if (key === lastModelsKey) return;
    lastModelsKey = key;
    if (models.length === 0) {
      defaultModel = "";
    } else if (!models.includes(defaultModel)) {
      defaultModel = models[0];
    }
  });

  // When a preset is picked in new mode, default the model to that preset's
  // default. Reads pickedPreset (not selectedModel) so it does not fight the
  // user's manual model-select choice.
  $effect(() => {
    if (mode === "new" && pickerChoice === "preset" && pickedPreset) {
      selectedModel = pickedPreset.defaultModel;
    }
  });

  // When the OpenAI-compatible template is picked in new mode, pre-fill the
  // custom form with sensible OpenAI defaults so the user only has to type
  // their compatible baseURL (and API key). Fires once per pickerChoice
  // transition into "openai-compat": it reads only mode + pickerChoice, so
  // the field writes below do not re-trigger it. baseURL is intentionally
  // left empty — the whole point of this template is user-supplied URL.
  $effect(() => {
    if (mode === "new" && pickerChoice === "openai-compat") {
      name = $_("settings_page.openai_compat_default_name");
      baseURL = "";
      modelsInput = "gpt-5.4, gpt-5.4-mini";
      defaultModel = "gpt-5.4-mini";
      selectedModel = "gpt-5.4-mini";
      apiKey = "";
    }
  });

  function isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  let errors = $derived({
    name:
      name.trim() === "" ? $_("settings_page.error_name_required") : undefined,
    baseURL:
      baseURL.trim() === ""
        ? $_("settings_page.error_base_url_required")
        : !isValidUrl(baseURL.trim())
          ? $_("settings_page.error_base_url_invalid")
          : undefined,
    models:
      models.length === 0
        ? $_("settings_page.error_models_required")
        : undefined,
  });

  let isCustomFormValid = $derived(
    errors.name === undefined &&
      errors.baseURL === undefined &&
      errors.models === undefined,
  );

  // --- Dirty / save-enabled flags per mode ---
  let isPresetEditDirty = $derived(
    mode === "edit" &&
      provider?.kind === "preset" &&
      (apiKey !== (config?.apiKey ?? "") ||
        selectedModel !==
          (config?.selectedModel ?? provider?.defaultModel ?? "")),
  );

  let isCustomEditDirty = $derived(
    mode === "edit" &&
      provider?.kind === "custom" &&
      (name !== (provider?.name ?? "") ||
        baseURL !== (provider?.baseURL ?? "") ||
        modelsInput !== (provider?.models.join(", ") ?? "") ||
        apiKey !== (config?.apiKey ?? "") ||
        defaultModel !== (provider?.defaultModel ?? "")),
  );

  let isNewPresetReady = $derived(
    mode === "new" &&
      pickerChoice === "preset" &&
      pickedPresetId !== "" &&
      apiKey.trim() !== "",
  );

  let isNewCustomReady = $derived(
    mode === "new" &&
      (pickerChoice === "custom" || pickerChoice === "openai-compat") &&
      isCustomFormValid,
  );

  let canSave = $derived(
    isPresetEditDirty ||
      (isCustomEditDirty && isCustomFormValid) ||
      isNewPresetReady ||
      isNewCustomReady,
  );

  let defaultModelTriggerText = $derived(
    models.length === 0
      ? $_("settings_page.default_model_placeholder")
      : defaultModel || $_("settings_page.default_model_placeholder"),
  );

  let presetSelectTriggerText = $derived(
    pickedPreset
      ? pickedPreset.name
      : $_("settings_page.preset_select_placeholder"),
  );

  let isEmptyState = $derived(mode === "edit" && provider === undefined);
  let isPresetEdit = $derived(mode === "edit" && provider?.kind === "preset");
  let isCustomEdit = $derived(mode === "edit" && provider?.kind === "custom");

  function handleSavePresetEdit(): void {
    if (!provider) return;
    onsave(
      {
        providerId: provider.id,
        apiKey: apiKey.trim(),
        selectedModel,
      },
      false,
    );
  }

  function handleSaveCustomEdit(): void {
    if (!provider) return;
    onsave(
      {
        providerId: provider.id,
        apiKey: apiKey.trim(),
        selectedModel: defaultModel,
        baseURL: baseURL.trim(),
        name: name.trim(),
        models: [...models],
        defaultModel,
      },
      false,
    );
  }

  function handleSaveNewPreset(): void {
    if (!pickedPreset) return;
    onsave(
      {
        providerId: pickedPreset.id,
        apiKey: apiKey.trim(),
        selectedModel,
      },
      true,
    );
  }

  function handleSaveNewCustom(): void {
    const providerId = "custom-" + crypto.randomUUID();
    onsave(
      {
        providerId,
        apiKey: apiKey.trim(),
        selectedModel: defaultModel,
        baseURL: baseURL.trim(),
        name: name.trim(),
        models: [...models],
        defaultModel,
      },
      true,
    );
  }

  function handleSave(): void {
    if (isPresetEdit) handleSavePresetEdit();
    else if (isCustomEdit) handleSaveCustomEdit();
    else if (isNewPresetReady) handleSaveNewPreset();
    else if (isNewCustomReady) handleSaveNewCustom();
  }

  function handleDelete(): void {
    if (!provider) return;
    if (window.confirm($_("settings_page.confirm_delete"))) {
      ondelete?.(provider.id);
    }
  }
</script>

{#if isEmptyState}
  <div
    data-testid="editor-empty"
    class="flex h-full flex-col items-center justify-center gap-2 border rounded-lg bg-card p-8 text-center"
  >
    <p class="text-lg font-medium text-foreground">
      {$_("settings_page.editor_empty_title")}
    </p>
    <p class="max-w-sm text-sm text-muted-foreground">
      {$_("settings_page.editor_empty_desc")}
    </p>
  </div>
{:else if mode === "new" && pickerChoice === null}
  <div
    data-testid="editor-picker"
    class="flex h-full flex-col gap-4 border rounded-lg bg-card p-6"
  >
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold text-foreground">
        {$_("settings_page.editor_picker_prompt")}
      </h2>
      <Button
        data-testid="cancel-button"
        variant="ghost"
        size="sm"
        onclick={() => oncancel()}
      >
        {$_("settings_page.button_cancel")}
      </Button>
    </div>
    <div class="flex flex-col gap-3">
      <button
        data-testid="preset-option"
        type="button"
        onclick={() => (pickerChoice = "preset")}
        class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
      >
        <div class="flex flex-col gap-0.5">
          <span class="font-medium text-foreground">
            {$_("settings_page.editor_preset_option")}
          </span>
          <span class="text-xs text-muted-foreground">
            {$_("settings_page.editor_preset_desc")}
          </span>
        </div>
      </button>
      <button
        data-testid="openai-compat-option"
        type="button"
        onclick={() => (pickerChoice = "openai-compat")}
        class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
      >
        <div class="flex flex-col gap-0.5">
          <span class="font-medium text-foreground">
            {$_("settings_page.editor_openai_compat_option")}
          </span>
          <span class="text-xs text-muted-foreground">
            {$_("settings_page.editor_openai_compat_desc")}
          </span>
        </div>
      </button>
      <button
        data-testid="custom-option"
        type="button"
        onclick={() => (pickerChoice = "custom")}
        class="flex items-center gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
      >
        <div class="flex flex-col gap-0.5">
          <span class="font-medium text-foreground">
            {$_("settings_page.editor_custom_option")}
          </span>
          <span class="text-xs text-muted-foreground">
            {$_("settings_page.editor_custom_desc")}
          </span>
        </div>
      </button>
    </div>
  </div>
{:else}
  <div
    data-testid="provider-editor-form"
    class="flex h-full flex-col gap-4 border rounded-lg bg-card p-6"
  >
    <!-- Header: title + cancel (new mode) -->
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-lg font-semibold text-foreground">
        {mode === "new"
          ? $_("settings_page.add_provider_title")
          : `${$_("settings_page.edit_provider_title")}: ${provider?.name ?? ""}`}
      </h2>
      {#if mode === "new"}
        <Button
          data-testid="cancel-button"
          variant="ghost"
          size="sm"
          onclick={() => oncancel()}
        >
          {$_("settings_page.button_cancel")}
        </Button>
      {/if}
    </div>

    <!-- NEW preset picker sub-form -->
    {#if mode === "new" && pickerChoice === "preset"}
      <div class="flex flex-col gap-2">
        <Label for="preset-select"
          >{$_("settings_page.preset_select_placeholder")}</Label
        >
        {#if unconfiguredPresets.length === 0}
          <p class="text-sm text-muted-foreground">
            {$_("settings_page.no_unconfigured_presets")}
          </p>
        {:else}
          <Select.Root type="single" bind:value={pickedPresetId}>
            <Select.Trigger
              id="preset-select"
              data-testid="preset-select"
              class="w-full"
            >
              {presetSelectTriggerText}
            </Select.Trigger>
            <Select.Content>
              {#each unconfiguredPresets as preset (preset.id)}
                <Select.Item value={preset.id} label={preset.name}>
                  {preset.name}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
      </div>

      {#if pickedPreset}
        <div class="flex flex-col gap-2">
          <Label for="new-preset-api-key"
            >{$_("settings_page.api_key_label")}</Label
          >
          <Input
            id="new-preset-api-key"
            type="password"
            data-testid="api-key-input"
            placeholder={$_("settings_page.api_key_placeholder")}
            autocomplete="off"
            bind:value={apiKey}
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="new-preset-model">{$_("settings_page.model_label")}</Label
          >
          <Select.Root type="single" bind:value={selectedModel}>
            <Select.Trigger
              id="new-preset-model"
              data-testid="model-select"
              class="w-full"
            >
              {selectedModel || pickedPreset.defaultModel}
            </Select.Trigger>
            <Select.Content>
              {#each pickedPreset.models as model (model)}
                <Select.Item value={model} label={model}>{model}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
      {/if}
    {:else if isPresetEdit}
      <!-- EDIT preset: API key + model only -->
      <div class="flex flex-col gap-2">
        <Label for="edit-api-key">{$_("settings_page.api_key_label")}</Label>
        <Input
          id="edit-api-key"
          type="password"
          data-testid="api-key-input"
          placeholder={$_("settings_page.api_key_placeholder")}
          autocomplete="off"
          bind:value={apiKey}
        />
      </div>

      <div class="flex flex-col gap-2">
        <Label for="edit-model">{$_("settings_page.model_label")}</Label>
        {#if provider}
          <Select.Root type="single" bind:value={selectedModel}>
            <Select.Trigger
              id="edit-model"
              data-testid="model-select"
              class="w-full"
            >
              {selectedModel}
            </Select.Trigger>
            <Select.Content>
              {#each provider.models as model (model)}
                <Select.Item value={model} label={model}>{model}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        {/if}
      </div>
    {:else if isCustomEdit || (mode === "new" && (pickerChoice === "custom" || pickerChoice === "openai-compat"))}
      <!-- EDIT custom / NEW custom: full definition form -->
      <div class="flex flex-col gap-2">
        <Label for="custom-name">{$_("settings_page.provider_name")}</Label>
        <Input
          id="custom-name"
          type="text"
          data-testid="name-input"
          aria-invalid={errors.name ? "true" : undefined}
          bind:value={name}
        />
        {#if errors.name}
          <p data-testid="error-name" class="text-xs text-destructive">
            {errors.name}
          </p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <Label for="custom-base-url"
          >{$_("settings_page.provider_base_url")}</Label
        >
        <Input
          id="custom-base-url"
          type="url"
          placeholder="https://api.example.com/v1"
          data-testid="base-url-input"
          aria-invalid={errors.baseURL ? "true" : undefined}
          bind:value={baseURL}
        />
        {#if errors.baseURL}
          <p data-testid="error-base-url" class="text-xs text-destructive">
            {errors.baseURL}
          </p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <Label for="custom-models">{$_("settings_page.provider_models")}</Label>
        <Input
          id="custom-models"
          type="text"
          placeholder="model-1, model-2"
          data-testid="models-input"
          aria-invalid={errors.models ? "true" : undefined}
          bind:value={modelsInput}
        />
        {#if errors.models}
          <p data-testid="error-models" class="text-xs text-destructive">
            {errors.models}
          </p>
        {/if}
      </div>

      <div class="flex flex-col gap-2">
        <Label for="custom-default-model"
          >{$_("settings_page.provider_default_model")}</Label
        >
        <Select.Root type="single" bind:value={defaultModel}>
          <Select.Trigger
            id="custom-default-model"
            data-testid="default-model-select"
            class="w-full"
          >
            {defaultModelTriggerText}
          </Select.Trigger>
          {#if models.length > 0}
            <Select.Content>
              {#each models as model (model)}
                <Select.Item value={model} label={model}>{model}</Select.Item>
              {/each}
            </Select.Content>
          {/if}
        </Select.Root>
      </div>

      <div class="flex flex-col gap-2">
        <Label for="custom-api-key">{$_("settings_page.api_key_label")}</Label>
        <Input
          id="custom-api-key"
          type="password"
          data-testid="api-key-input"
          placeholder={$_("settings_page.api_key_placeholder")}
          autocomplete="off"
          bind:value={apiKey}
        />
      </div>
    {/if}

    <!-- Footer: save + delete -->
    <div class="mt-auto flex items-center gap-2 pt-2">
      <Button
        data-testid="save-button"
        disabled={!canSave}
        onclick={handleSave}
      >
        {$_("settings_page.button_save")}
      </Button>
      {#if isCustomEdit && ondelete}
        <Button
          variant="destructive"
          data-testid="delete-button"
          onclick={handleDelete}
        >
          {$_("settings_page.button_delete")}
        </Button>
      {/if}
    </div>
  </div>
{/if}
