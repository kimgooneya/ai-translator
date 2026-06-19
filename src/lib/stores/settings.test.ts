import { describe, it, expect } from "vitest";
import { migrateSettings } from "./settings";
import type { Settings, ProviderConfig } from "$lib/schemas";

function settingsWith(providers: ProviderConfig[]): Settings {
  return {
    providers,
    activeProviderId: providers[0]?.providerId ?? null,
    defaultTargetLang: "ko",
  };
}

describe("migrateSettings", () => {
  it("leaves a provider config unchanged", () => {
    const config: ProviderConfig = {
      providerId: "openai",
      selectedModel: "gpt-5.4-mini",
    };
    const result = migrateSettings(settingsWith([config]));
    expect(result.providers[0].selectedModel).toBe("gpt-5.4-mini");
  });

  it("handles an empty providers array", () => {
    const s = settingsWith([]);
    expect(migrateSettings(s)).toEqual(s);
  });

  it("preserves activeProviderId and defaultTargetLang", () => {
    const s: Settings = {
      providers: [{ providerId: "gemini", selectedModel: "gemini-3.5-flash" }],
      activeProviderId: "gemini",
      defaultTargetLang: "ja",
    };
    const result = migrateSettings(s);
    expect(result.activeProviderId).toBe("gemini");
    expect(result.defaultTargetLang).toBe("ja");
  });

  it("preserves customPrompt when present", () => {
    const s: Settings = {
      providers: [],
      activeProviderId: null,
      defaultTargetLang: "ko",
      customPrompt: "편하게 번역해줘",
    };
    const result = migrateSettings(s);
    expect(result.customPrompt).toBe("편하게 번역해줘");
  });

  it("does not mutate the input settings", () => {
    const config: ProviderConfig = {
      providerId: "gemini",
      selectedModel: "gemini-3.5-flash",
    };
    const input = settingsWith([config]);
    const inputSnapshot = JSON.parse(JSON.stringify(input));
    migrateSettings(input);
    expect(input).toEqual(inputSnapshot);
  });
});
