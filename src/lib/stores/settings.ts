import { persistedWritable } from "$lib/storage/stores";
import { settingsSchema } from "$lib/schemas";
import type { Settings } from "$lib/schemas";
import { STORAGE_KEYS } from "$lib/storage";

const fallback: Settings = {
  providers: [],
  activeProviderId: null,
  defaultTargetLang: "ko",
};

/**
 * Settings migration.
 *
 * Managed-key model: provider presets (incl. their model lists) now live in
 * the DB and are fetched into `providerCatalogStore`. Client settings no
 * longer carry API keys or custom-provider definitions, so there is nothing
 * to reconcile against a static `PRESET_PROVIDERS` list here. We pass the
 * stored settings through unchanged; the schema already strips legacy
 * `apiKey`/`baseURL`/`params`/custom-definition fields on load.
 *
 * Stale-model reset against the live catalog is handled where the catalog is
 * available (the page), not in this synchronous localStorage migration.
 */
export function migrateSettings(s: Settings): Settings {
  return { ...s };
}

export const settingsStore = persistedWritable(
  STORAGE_KEYS.settings,
  settingsSchema,
  fallback,
  migrateSettings,
);

/**
 * Select the active provider. Used by the settings page and the provider
 * picker on the translate page.
 */
export function setActiveProvider(providerId: string): void {
  settingsStore.update((s) => ({ ...s, activeProviderId: providerId }));
}

/**
 * Remember the user's model preference for a given provider. Idempotent:
 * upserts a `{providerId, selectedModel}` entry into `providers`.
 */
export function setSelectedModel(
  providerId: string,
  selectedModel: string,
): void {
  settingsStore.update((s) => {
    const idx = s.providers.findIndex((p) => p.providerId === providerId);
    const config = { providerId, selectedModel };
    const next =
      idx >= 0
        ? s.providers.map((p, i) => (i === idx ? config : p))
        : [...s.providers, config];
    return { ...s, providers: next };
  });
}
