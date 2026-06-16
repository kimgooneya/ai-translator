import { describe, it, expect, vi } from "vitest";
import type { Provider, ProviderConfig, Settings } from "$lib/schemas";

const { constructorCalls, MockOpenAI } = vi.hoisted(() => {
  const constructorCalls: Array<{
    apiKey: string | null;
    baseURL: string | null;
    dangerouslyAllowBrowser: boolean | undefined;
  }> = [];
  class MockOpenAI {
    apiKey: string | null;
    baseURL: string | null;
    dangerouslyAllowBrowser: boolean | undefined;
    constructor(opts?: {
      apiKey?: string;
      baseURL?: string;
      dangerouslyAllowBrowser?: boolean;
    }) {
      this.apiKey = opts?.apiKey ?? null;
      this.baseURL = opts?.baseURL ?? null;
      this.dangerouslyAllowBrowser = opts?.dangerouslyAllowBrowser;
      constructorCalls.push({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
        dangerouslyAllowBrowser: this.dangerouslyAllowBrowser,
      });
    }
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
  }
  return { constructorCalls, MockOpenAI };
});

vi.mock("openai", () => ({ default: MockOpenAI }));

import {
  createProviderClient,
  getAllProviders,
  getProviderById,
  validateProviderConfig,
} from "./registry";
import { PRESET_PROVIDERS } from "./presets";

const emptySettings: Settings = {
  providers: [],
  activeProviderId: null,
  defaultTargetLang: "ko",
};

function makeSettingsWithCustoms(customs: ProviderConfig[]): Settings {
  return {
    providers: customs,
    activeProviderId: customs[0]?.providerId ?? null,
    defaultTargetLang: "ko",
  };
}

const openaiProvider = PRESET_PROVIDERS.find((p) => p.id === "openai")!;

const validOpenAIConfig: ProviderConfig = {
  providerId: "openai",
  apiKey: "sk-test-123",
  selectedModel: "gpt-5.4-mini",
};

const customProviderConfig: ProviderConfig = {
  providerId: "my-custom",
  apiKey: "sk-custom-123",
  selectedModel: "my-model-1",
  baseURL: "https://api.example.com/v1",
};

describe("createProviderClient", () => {
  it("returns an OpenAI client instance", () => {
    const client = createProviderClient(
      validOpenAIConfig,
      "https://api.openai.com/v1",
    );
    expect(client).toBeDefined();
    expect(typeof client.chat.completions.create).toBe("function");
  });

  it("passes apiKey and baseURL to the OpenAI constructor", () => {
    constructorCalls.length = 0;
    createProviderClient(validOpenAIConfig, "https://api.openai.com/v1");
    expect(constructorCalls).toHaveLength(1);
    expect(constructorCalls[0].apiKey).toBe("sk-test-123");
    expect(constructorCalls[0].baseURL).toBe("https://api.openai.com/v1");
  });

  it("forces dangerouslyAllowBrowser=false (server-side only)", () => {
    constructorCalls.length = 0;
    createProviderClient(validOpenAIConfig, "https://api.openai.com/v1");
    expect(constructorCalls[0].dangerouslyAllowBrowser).toBe(false);
  });
});

describe("getAllProviders", () => {
  it("returns 6 presets + 0 customs for empty settings", () => {
    const all = getAllProviders(emptySettings);
    expect(all).toHaveLength(6);
    expect(all.filter((p) => p.kind === "preset")).toHaveLength(6);
    expect(all.filter((p) => p.kind === "custom")).toHaveLength(0);
  });

  it("returns 6 presets + N customs when settings has custom providers", () => {
    const settings = makeSettingsWithCustoms([customProviderConfig]);
    const all = getAllProviders(settings);
    expect(all).toHaveLength(7);
    const customs = all.filter((p) => p.kind === "custom");
    expect(customs).toHaveLength(1);
    expect(customs[0].id).toBe("my-custom");
    expect(customs[0].baseURL).toBe("https://api.example.com/v1");
  });

  it("does not duplicate preset providers when settings has preset configs", () => {
    const settings: Settings = {
      providers: [
        { providerId: "openai", apiKey: "sk-1", selectedModel: "gpt-5.4-mini" },
        customProviderConfig,
      ],
      activeProviderId: "openai",
      defaultTargetLang: "ko",
    };
    const all = getAllProviders(settings);
    expect(all).toHaveLength(7);
    expect(all.filter((p) => p.id === "openai")).toHaveLength(1);
    expect(all.filter((p) => p.id === "my-custom")).toHaveLength(1);
  });

  it("presets always come first, customs last", () => {
    const settings = makeSettingsWithCustoms([customProviderConfig]);
    const all = getAllProviders(settings);
    expect(all[0].kind).toBe("preset");
    expect(all[6].kind).toBe("custom");
  });
});

describe("getProviderById", () => {
  it("returns matching provider for a known preset id", () => {
    const result = getProviderById(emptySettings, "openai");
    expect(result).toBeDefined();
    expect(result?.id).toBe("openai");
    expect(result?.name).toBe("OpenAI");
  });

  it("returns matching provider for a custom id", () => {
    const settings = makeSettingsWithCustoms([customProviderConfig]);
    const result = getProviderById(settings, "my-custom");
    expect(result).toBeDefined();
    expect(result?.id).toBe("my-custom");
    expect(result?.kind).toBe("custom");
  });

  it("returns undefined for an unknown id", () => {
    expect(getProviderById(emptySettings, "does-not-exist")).toBeUndefined();
  });

  it("returns undefined for empty string id", () => {
    expect(getProviderById(emptySettings, "")).toBeUndefined();
  });
});

describe("validateProviderConfig", () => {
  it("returns valid:true for correct apiKey + model (preset)", () => {
    const result = validateProviderConfig(validOpenAIConfig, openaiProvider);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns valid:false with error for empty apiKey", () => {
    const result = validateProviderConfig(
      { ...validOpenAIConfig, apiKey: "" },
      openaiProvider,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/api key/i);
  });

  it("returns valid:false with error for whitespace-only apiKey", () => {
    const result = validateProviderConfig(
      { ...validOpenAIConfig, apiKey: "   " },
      openaiProvider,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/api key/i);
  });

  it("returns valid:false with error when model is not in provider.models", () => {
    const result = validateProviderConfig(
      { ...validOpenAIConfig, selectedModel: "not-a-real-model" },
      openaiProvider,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/model/i);
  });

  it("returns valid:false with error when baseURL missing for custom provider", () => {
    const customProvider: Provider = {
      id: "my-custom",
      name: "My Custom",
      kind: "custom",
      baseURL: "",
      models: ["my-model-1"],
      defaultModel: "my-model-1",
    };
    const result = validateProviderConfig(
      { ...customProviderConfig, baseURL: undefined },
      customProvider,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/baseurl/i);
  });

  it("returns valid:true for custom provider with baseURL present", () => {
    const customProvider: Provider = {
      id: "my-custom",
      name: "My Custom",
      kind: "custom",
      baseURL: "https://api.example.com/v1",
      models: ["my-model-1"],
      defaultModel: "my-model-1",
    };
    const result = validateProviderConfig(customProviderConfig, customProvider);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("does not require baseURL for preset providers", () => {
    const result = validateProviderConfig(validOpenAIConfig, openaiProvider);
    expect(result.valid).toBe(true);
  });
});
