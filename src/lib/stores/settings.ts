import { persistedWritable } from "$lib/storage/stores";
import { settingsSchema } from "$lib/schemas";
import type { Settings, ProviderConfig } from "$lib/schemas";
import { STORAGE_KEYS } from "$lib/storage";
import { PRESET_PROVIDERS } from "$lib/providers/presets";

const fallback: Settings = {
  providers: [],
  activeProviderId: null,
  defaultTargetLang: "ko",
};

export function migrateSettings(s: Settings): Settings {
  return {
    ...s,
    providers: s.providers.map((c) => {
      const preset = PRESET_PROVIDERS.find((p) => p.id === c.providerId);
      if (!preset) return c;
      if (preset.models.includes(c.selectedModel)) return c;
      return { ...c, selectedModel: preset.defaultModel };
    }),
  };
}

export const settingsStore = persistedWritable(
  STORAGE_KEYS.settings,
  settingsSchema,
  fallback,
  migrateSettings,
);

export function upsertProviderConfig(config: ProviderConfig): void {
  settingsStore.update((s) => {
    const idx = s.providers.findIndex(
      (p) => p.providerId === config.providerId,
    );
    const next =
      idx >= 0
        ? s.providers.map((p, i) => (i === idx ? config : p))
        : [...s.providers, config];
    return { ...s, providers: next };
  });
}

export function removeProviderConfig(providerId: string): void {
  settingsStore.update((s) => ({
    ...s,
    providers: s.providers.filter((p) => p.providerId !== providerId),
    activeProviderId:
      s.activeProviderId === providerId ? null : s.activeProviderId,
  }));
}

export function setActiveProvider(providerId: string): void {
  settingsStore.update((s) => ({ ...s, activeProviderId: providerId }));
}
