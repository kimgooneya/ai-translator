<script lang="ts">
  import { _ } from "svelte-i18n";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import {
    settingsStore,
    setActiveProvider,
    setSelectedModel,
  } from "$lib/stores/settings";
  import {
    providerCatalogStore,
    providerCatalogLoading,
    providerCatalogError,
  } from "$lib/stores/providers";
  import DismissibleNotice from "./DismissibleNotice.svelte";
  import type { Provider } from "$lib/schemas";

  let settings = $derived($settingsStore);
  let catalog = $derived($providerCatalogStore);
  let loading = $derived($providerCatalogLoading);
  let loadError = $derived($providerCatalogError);

  let activeProvider = $derived(
    catalog.find((p) => p.id === settings.activeProviderId) ?? undefined,
  );

  function selectedModelFor(provider: Provider): string {
    const cfg = settings.providers.find((c) => c.providerId === provider.id);
    return cfg?.selectedModel ?? provider.defaultModel;
  }

  function handlePickProvider(provider: Provider): void {
    setActiveProvider(provider.id);
    // Remember a model preference for the newly-active provider so the
    // translate page has one ready without an extra round-trip.
    const cfg = settings.providers.find((c) => c.providerId === provider.id);
    if (!cfg) setSelectedModel(provider.id, provider.defaultModel);
  }

  // Local model state for the active provider's model Select. Re-seeded when
  // the active provider changes; user picks are persisted to the settings store.
  let activeModel = $state("");
  let lastProviderId: string | null = null;
  $effect(() => {
    const pid = settings.activeProviderId;
    if (pid !== lastProviderId) {
      lastProviderId = pid;
      activeModel = activeProvider ? selectedModelFor(activeProvider) : "";
    } else if (
      activeProvider &&
      activeModel &&
      selectedModelFor(activeProvider) !== activeModel
    ) {
      setSelectedModel(activeProvider.id, activeModel);
    }
  });
</script>

<div class="flex flex-col gap-6 text-foreground">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      {$_("settings_page.title")}
    </h1>
  </header>

  <DismissibleNotice
    id="settings.security-notice"
    variant="blue"
    testId="security-notice"
    message={$_("settings_page.security_notice")}
  />

  <div class="flex flex-col gap-4">
    <h2 class="text-lg font-semibold text-foreground">
      {$_("settings_page.list_title")}
    </h2>

    {#if loadError}
      <p data-testid="provider-catalog-error" class="text-sm text-destructive">
        {loadError}
      </p>
    {:else if loading && catalog.length === 0}
      <p data-testid="provider-catalog-loading" class="text-sm text-muted-foreground">
        {$_("settings_page.loading_providers")}
      </p>
    {:else if catalog.length === 0}
      <p data-testid="provider-list-empty" class="text-sm text-muted-foreground">
        {$_("settings_page.no_providers")}
      </p>
    {:else}
      <ul class="flex flex-col gap-2">
        {#each catalog as provider (provider.id)}
          {@const isActive = provider.id === settings.activeProviderId}
          <li>
            <div
              data-testid="provider-item"
              data-provider-id={provider.id}
              class="flex cursor-pointer flex-col gap-2 rounded-md border p-3 transition-colors {isActive
                ? 'border-primary bg-accent ring-1 ring-primary/30'
                : 'border-border hover:bg-muted/50'}"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-medium text-foreground"
                  >{provider.name}</span
                >
                {#if isActive}
                  <Badge data-testid="active-badge" variant="default">
                    {$_("settings_page.badge_active")}
                  </Badge>
                {:else}
                  <Button
                    data-testid="set-active-button"
                    variant="ghost"
                    size="sm"
                    class="h-7 px-3 text-xs"
                    onclick={() => handlePickProvider(provider)}
                  >
                    {$_("settings_page.action_set_active")}
                  </Button>
                {/if}
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if activeProvider}
      <div
        data-testid="active-provider-model"
        class="flex flex-col gap-2 rounded-md border border-border bg-card p-4"
      >
        <Label for="active-model-select" class="text-sm font-medium">
          {$_("settings_page.model_label")} — {activeProvider.name}
        </Label>
        <Select.Root type="single" bind:value={activeModel}>
          <Select.Trigger
            id="active-model-select"
            data-testid="model-select"
            class="w-full"
          >
            {activeModel || activeProvider.defaultModel}
          </Select.Trigger>
          <Select.Content>
            {#each activeProvider.models as m (m)}
              <Select.Item value={m} label={m}>{m}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
    {/if}
  </div>
</div>
