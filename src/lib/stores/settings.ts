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
 * Settings migration — finalized for the managed-key model.
 *
 * Legacy BYOK fields (`apiKey`, `baseURL`, `params`, and any custom-provider
 * definitions nested under `providers[]`) are stripped automatically: the
 * `settingsSchema`/`providerConfigSchema` only allow `providerId` +
 * `selectedModel`, and Zod's default strip mode (in `loadFromStorage`'s
 * `schema.parse`) drops unknown keys before this function runs. So old BYOK
 * localStorage never leaks secrets back into the app, and there is nothing
 * left to strip here — this is an intentional passthrough.
 *
 * Stale-model reset (a stored `selectedModel` no longer in the live catalog)
 * is NOT handled here: it needs the catalog, which is only available on the
 * page, not in this synchronous localStorage migration.
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
