<script lang="ts">
  import {
    settingsStore,
    upsertProviderConfig,
    removeProviderConfig,
    setActiveProvider,
  } from "$lib/stores/settings";
  import { PRESET_PROVIDERS } from "$lib/providers/presets";
  import { getProviderById } from "$lib/providers/registry";
  import { _ } from "svelte-i18n";
  import type { Provider, ProviderConfig } from "$lib/schemas";
  import ProviderList from "$lib/components/ProviderList.svelte";
  import ProviderEditor from "$lib/components/ProviderEditor.svelte";

  let settings = $derived($settingsStore);

  // Page owns ALL state; the two panes are presentational.
  let selectedId = $state<string | null>(null);
  let isNewMode = $state<boolean>(false);

  // Configured providers = for each stored config, resolve via registry.
  let configuredProviders = $derived<Provider[]>(
    settings.providers
      .map((c) => getProviderById(settings, c.providerId))
      .filter((p): p is Provider => p !== undefined),
  );

  // Unconfigured presets = presets without a stored config (available to add).
  let unconfiguredPresets = $derived<Provider[]>(
    PRESET_PROVIDERS.filter(
      (p) => !settings.providers.some((c) => c.providerId === p.id),
    ),
  );

  let selectedProvider = $derived(
    selectedId
      ? (getProviderById(settings, selectedId) ?? undefined)
      : undefined,
  );

  let selectedConfig = $derived(
    selectedId
      ? (settings.providers.find((c) => c.providerId === selectedId) ??
          undefined)
      : undefined,
  );

  let editorMode = $derived<"edit" | "new">(isNewMode ? "new" : "edit");

  function handleSelect(providerId: string): void {
    selectedId = providerId;
    isNewMode = false;
  }

  function handleNew(): void {
    isNewMode = true;
    selectedId = null;
  }

  function handleCancelNew(): void {
    isNewMode = false;
    selectedId = null;
  }

  function handleSave(config: ProviderConfig, isNew: boolean): void {
    const wasEmpty = settings.providers.length === 0;
    upsertProviderConfig(config);
    if (wasEmpty) {
      setActiveProvider(config.providerId);
    }
    if (isNew) {
      selectedId = config.providerId;
      isNewMode = false;
    }
  }

  function handleDelete(providerId: string): void {
    removeProviderConfig(providerId);
    selectedId = null;
  }

  function handleSetActive(providerId: string): void {
    setActiveProvider(providerId);
  }
</script>

<svelte:head>
  <title>{$_("settings_page.title")} – {$_("app.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4 text-foreground">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      {$_("settings_page.title")}
    </h1>
  </header>

  <div
    data-testid="security-notice"
    class="border border-yellow-200 bg-yellow-50 rounded-md p-4 dark:border-yellow-700 dark:bg-yellow-900/30"
  >
    <p class="text-sm text-yellow-800 dark:text-yellow-200">
      {$_("settings_page.security_notice")}
    </p>
  </div>

  <div class="grid gap-6 md:grid-cols-[300px_1fr]" style="min-height: 480px;">
    <div class="md:h-[600px]">
      <ProviderList
        providers={configuredProviders}
        configs={settings.providers}
        activeProviderId={settings.activeProviderId}
        {selectedId}
        onselect={handleSelect}
        onSetActive={handleSetActive}
        onnew={handleNew}
      />
    </div>
    <div data-testid="provider-editor" class="md:h-[600px]">
      <ProviderEditor
        mode={editorMode}
        provider={selectedProvider}
        config={selectedConfig}
        {unconfiguredPresets}
        onsave={handleSave}
        ondelete={handleDelete}
        oncancel={handleCancelNew}
      />
    </div>
  </div>
</div>
