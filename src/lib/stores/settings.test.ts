import { describe, it, expect } from "vitest";
import { migrateSettings } from "./settings";
import { PRESET_PROVIDERS } from "$lib/providers/presets";
import type { Settings, ProviderConfig } from "$lib/schemas";

const openai = PRESET_PROVIDERS.find((p) => p.id === "openai")!;
const gemini = PRESET_PROVIDERS.find((p) => p.id === "gemini")!;

function settingsWith(providers: ProviderConfig[]): Settings {
  return {
    providers,
    activeProviderId: providers[0]?.providerId ?? null,
    defaultTargetLang: "ko",
  };
}

describe("migrateSettings", () => {
  it("leaves a preset config unchanged when its model is still offered", () => {
    const config: ProviderConfig = {
      providerId: "openai",
      apiKey: "sk-1",
      selectedModel: openai.models[0],
    };
    const result = migrateSettings(settingsWith([config]));
    expect(result.providers[0].selectedModel).toBe(openai.models[0]);
  });

  it("falls back to the preset default when the stored model was removed", () => {
    const config: ProviderConfig = {
      providerId: "gemini",
      apiKey: "sk-1",
      selectedModel: "gemini-2.5-flash-lite-removed",
    };
    const result = migrateSettings(settingsWith([config]));
    expect(result.providers[0].selectedModel).toBe(gemini.defaultModel);
  });

  it("does not touch custom (non-preset) provider configs", () => {
    const config: ProviderConfig = {
      providerId: "my-custom",
      apiKey: "sk-x",
      selectedModel: "any-model-name",
      baseURL: "https://api.example.com/v1",
    };
    const result = migrateSettings(settingsWith([config]));
    expect(result.providers[0]).toEqual(config);
  });

  it("handles an empty providers array", () => {
    const s = settingsWith([]);
    expect(migrateSettings(s)).toEqual(s);
  });

  it("migrates a mix of valid, stale, and custom providers independently", () => {
    const valid: ProviderConfig = {
      providerId: "openai",
      apiKey: "sk-1",
      selectedModel: openai.defaultModel,
    };
    const stale: ProviderConfig = {
      providerId: "gemini",
      apiKey: "sk-2",
      selectedModel: "gemini-2.5-flash-removed",
    };
    const custom: ProviderConfig = {
      providerId: "my-custom",
      apiKey: "sk-3",
      selectedModel: "custom-model",
      baseURL: "https://api.example.com/v1",
    };
    const result = migrateSettings(settingsWith([valid, stale, custom]));
    expect(result.providers[0].selectedModel).toBe(openai.defaultModel);
    expect(result.providers[1].selectedModel).toBe(gemini.defaultModel);
    expect(result.providers[2].selectedModel).toBe("custom-model");
  });

  it("preserves all other fields on a migrated config", () => {
    const config: ProviderConfig = {
      providerId: "gemini",
      apiKey: "sk-keep",
      selectedModel: "gemini-2.5-removed",
      baseURL: "https://example.com/v1",
      params: { temperature: 0.7, maxTokens: 1000 },
    };
    const result = migrateSettings(settingsWith([config]));
    const migrated = result.providers[0];
    expect(migrated.apiKey).toBe("sk-keep");
    expect(migrated.baseURL).toBe("https://example.com/v1");
    expect(migrated.params).toEqual({ temperature: 0.7, maxTokens: 1000 });
    expect(migrated.selectedModel).toBe(gemini.defaultModel);
  });

  it("preserves activeProviderId and defaultTargetLang", () => {
    const s: Settings = {
      providers: [
        {
          providerId: "gemini",
          apiKey: "sk-1",
          selectedModel: "gemini-2.5-removed",
        },
      ],
      activeProviderId: "gemini",
      defaultTargetLang: "ja",
    };
    const result = migrateSettings(s);
    expect(result.activeProviderId).toBe("gemini");
    expect(result.defaultTargetLang).toBe("ja");
  });

  it("does not mutate the input settings", () => {
    const config: ProviderConfig = {
      providerId: "gemini",
      apiKey: "sk-1",
      selectedModel: "gemini-2.5-removed",
    };
    const input = settingsWith([config]);
    const inputSnapshot = JSON.parse(JSON.stringify(input));
    migrateSettings(input);
    expect(input).toEqual(inputSnapshot);
  });
});
