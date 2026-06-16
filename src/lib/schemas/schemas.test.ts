import { describe, it, expect } from "vitest";
import {
  providerSchema,
  providerConfigSchema,
  settingsSchema,
  glossaryEntrySchema,
  glossarySchema,
  translationRequestSchema,
  translationHistoryEntrySchema,
} from "./index";
import { PRESET_PROVIDERS, isPresetId } from "$lib/providers/presets";

describe("providerSchema", () => {
  it("accepts a valid preset provider", () => {
    const valid = {
      id: "openai",
      name: "OpenAI",
      kind: "preset" as const,
      baseURL: "https://api.openai.com/v1",
      models: ["gpt-5.4"],
      defaultModel: "gpt-5.4",
    };
    expect(providerSchema.parse(valid)).toEqual(valid);
  });

  it("accepts a valid custom provider", () => {
    const valid = {
      id: "my-provider",
      name: "My Custom",
      kind: "custom" as const,
      baseURL: "https://api.example.com/v1",
      models: ["m1"],
      defaultModel: "m1",
    };
    expect(providerSchema.parse(valid)).toEqual(valid);
  });

  it("rejects invalid baseURL", () => {
    const invalid = {
      id: "x",
      name: "X",
      kind: "preset" as const,
      baseURL: "not-a-url",
      models: ["m"],
      defaultModel: "m",
    };
    expect(() => providerSchema.parse(invalid)).toThrow();
  });

  it("rejects empty models array", () => {
    const invalid = {
      id: "x",
      name: "X",
      kind: "preset" as const,
      baseURL: "https://api.example.com",
      models: [],
      defaultModel: "m",
    };
    expect(() => providerSchema.parse(invalid)).toThrow();
  });

  it("rejects invalid kind", () => {
    const invalid = {
      id: "x",
      name: "X",
      kind: "unknown",
      baseURL: "https://api.example.com",
      models: ["m"],
      defaultModel: "m",
    };
    expect(() => providerSchema.parse(invalid)).toThrow();
  });
});

describe("providerConfigSchema", () => {
  it("accepts valid config without params", () => {
    const valid = {
      providerId: "openai",
      apiKey: "sk-xxx",
      selectedModel: "gpt-5.4",
    };
    expect(providerConfigSchema.parse(valid)).toEqual(valid);
  });

  it("accepts valid config with params", () => {
    const valid = {
      providerId: "openai",
      apiKey: "sk-xxx",
      selectedModel: "gpt-5.4",
      params: { temperature: 0.3, maxTokens: 1000 },
    };
    expect(providerConfigSchema.parse(valid)).toEqual(valid);
  });

  it("rejects temperature > 2", () => {
    const invalid = {
      providerId: "openai",
      apiKey: "sk-xxx",
      selectedModel: "gpt-5.4",
      params: { temperature: 5 },
    };
    expect(() => providerConfigSchema.parse(invalid)).toThrow();
  });

  it("allows empty apiKey (validation happens at request time)", () => {
    const valid = {
      providerId: "openai",
      apiKey: "",
      selectedModel: "gpt-5.4",
    };
    expect(providerConfigSchema.parse(valid)).toEqual(valid);
  });
});

describe("settingsSchema", () => {
  it("applies defaults for optional fields", () => {
    const parsed = settingsSchema.parse({
      providers: [],
      activeProviderId: null,
    });
    expect(parsed.defaultTargetLang).toBe("ko");
  });

  it("accepts null activeProviderId", () => {
    const valid = { providers: [], activeProviderId: null };
    expect(settingsSchema.parse(valid).activeProviderId).toBeNull();
  });
});

describe("glossarySchema", () => {
  it("applies defaults", () => {
    const parsed = glossarySchema.parse({});
    expect(parsed.enabled).toBe(false);
    expect(parsed.entries).toEqual([]);
  });

  it("accepts populated glossary", () => {
    const valid = {
      enabled: true,
      entries: [
        { id: "1", source: "RAG", target: "검색 증강 생성" },
        { id: "2", source: "LLM", target: "대형 언어 모델", note: "공식 명칭" },
      ],
    };
    expect(glossarySchema.parse(valid)).toEqual(valid);
  });
});

describe("glossaryEntrySchema", () => {
  it("rejects empty source", () => {
    expect(() =>
      glossaryEntrySchema.parse({ id: "1", source: "", target: "x" }),
    ).toThrow();
  });
});

describe("translationRequestSchema", () => {
  const validBase = {
    sourceText: "hello",
    sourceLang: "auto" as const,
    targetLang: "ko",
    providerId: "openai",
    apiKey: "sk-xxx",
    model: "gpt-5.4",
  };

  it("accepts minimal valid request", () => {
    expect(translationRequestSchema.parse(validBase)).toEqual(validBase);
  });

  it("accepts auto source language", () => {
    const parsed = translationRequestSchema.parse(validBase);
    expect(parsed.sourceLang).toBe("auto");
  });

  it("rejects empty sourceText", () => {
    expect(() =>
      translationRequestSchema.parse({ ...validBase, sourceText: "" }),
    ).toThrow();
  });

  it("rejects empty apiKey", () => {
    expect(() =>
      translationRequestSchema.parse({ ...validBase, apiKey: "" }),
    ).toThrow();
  });

  it("accepts glossary and customPrompt", () => {
    const valid = {
      ...validBase,
      glossary: {
        enabled: true,
        entries: [{ id: "1", source: "RAG", target: "검색 증강 생성" }],
      },
      customPrompt: "비즈니스 격식체",
    };
    expect(translationRequestSchema.parse(valid).customPrompt).toBe(
      "비즈니스 격식체",
    );
  });

  it("accepts optional cleanSourceText boolean", () => {
    const parsed = translationRequestSchema.parse({
      ...validBase,
      cleanSourceText: true,
    });
    expect(parsed.cleanSourceText).toBe(true);
  });

  it("accepts request without cleanSourceText (backward compat)", () => {
    expect(
      translationRequestSchema.parse(validBase).cleanSourceText,
    ).toBeUndefined();
  });
});

describe("translationHistoryEntrySchema", () => {
  it("accepts valid history entry", () => {
    const valid = {
      id: "h1",
      request: {
        sourceText: "hello",
        sourceLang: "auto",
        targetLang: "ko",
        providerId: "openai",
        apiKey: "sk-xxx",
        model: "gpt-5.4",
      },
      response: "안녕하세요",
      providerName: "OpenAI",
      modelName: "gpt-5.4",
      createdAt: "2026-06-14T07:00:00.000Z",
    };
    expect(translationHistoryEntrySchema.parse(valid).response).toBe(
      "안녕하세요",
    );
  });

  it("accepts optional tokensUsed", () => {
    const valid = {
      id: "h1",
      request: {
        sourceText: "hello",
        sourceLang: "auto",
        targetLang: "ko",
        providerId: "openai",
        apiKey: "sk-xxx",
        model: "gpt-5.4",
      },
      response: "안녕하세요",
      providerName: "OpenAI",
      modelName: "gpt-5.4",
      createdAt: "2026-06-14T07:00:00.000Z",
      tokensUsed: 42,
    };
    expect(translationHistoryEntrySchema.parse(valid).tokensUsed).toBe(42);
  });
});

describe("PRESET_PROVIDERS", () => {
  it("contains exactly 6 preset providers", () => {
    expect(PRESET_PROVIDERS).toHaveLength(6);
  });

  it('all presets have kind "preset"', () => {
    for (const p of PRESET_PROVIDERS) {
      expect(p.kind).toBe("preset");
    }
  });

  it("all presets pass providerSchema validation", () => {
    for (const p of PRESET_PROVIDERS) {
      expect(providerSchema.parse(p)).toEqual(p);
    }
  });

  it("all presets have unique ids", () => {
    const ids = PRESET_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all defaultModels are in models list", () => {
    for (const p of PRESET_PROVIDERS) {
      expect(p.models).toContain(p.defaultModel);
    }
  });

  it("includes the expected 6 ids", () => {
    const ids = PRESET_PROVIDERS.map((p) => p.id).sort();
    expect(ids).toEqual([
      "anthropic",
      "deepseek",
      "gemini",
      "openai",
      "qwen",
      "zhipu",
    ]);
  });

  it("isPresetId returns true for known ids, false for unknown", () => {
    expect(isPresetId("openai")).toBe(true);
    expect(isPresetId("my-custom")).toBe(false);
  });
});
