import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TranslationRequest, ResolvedProvider } from "$lib/schemas";

const { mockCreate, constructorCalls, MockOpenAI } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  const constructorCalls: Array<{
    apiKey: string | null;
    baseURL: string | null;
  }> = [];
  class MockOpenAI {
    apiKey: string | null;
    baseURL: string | null;
    constructor(opts?: {
      apiKey?: string;
      baseURL?: string;
      [k: string]: unknown;
    }) {
      this.apiKey = opts?.apiKey ?? null;
      this.baseURL = opts?.baseURL ?? null;
      constructorCalls.push({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
    }
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  }
  return { mockCreate, constructorCalls, MockOpenAI };
});

vi.mock("openai", () => ({
  default: MockOpenAI,
}));

import { buildTranslationMessages, streamTranslation } from "./translate";

const baseRequest: TranslationRequest = {
  sourceText: "Hello, world!",
  sourceLang: "auto",
  targetLang: "ko",
  providerId: "openai",
  model: "gpt-5.4-mini",
};

// Fully-resolved provider (server-built). apiKey is the decrypted managed key;
// baseURL comes from the DB preset. streamTranslation consumes this directly.
const baseProvider: ResolvedProvider = {
  id: "openai",
  name: "OpenAI",
  baseURL: "https://api.openai.com/v1",
  models: ["gpt-5.4-mini"],
  defaultModel: "gpt-5.4-mini",
  apiKey: "sk-test-123",
};

function makeAsyncIterable(
  chunks: Array<{ choices: Array<{ delta: { content?: string } }> }>,
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

describe("buildTranslationMessages", () => {
  it("returns system + user message (length 2)", () => {
    const msgs = buildTranslationMessages(baseRequest);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[1].role).toBe("user");
  });

  it("system message contains target language", () => {
    const msgs = buildTranslationMessages(baseRequest);
    const sys = msgs[0].content as string;
    expect(sys).toContain("ko");
    expect(sys.toLowerCase()).toMatch(/translate.*to.*ko/);
  });

  it('system message contains "detect" when sourceLang is "auto"', () => {
    const msgs = buildTranslationMessages({
      ...baseRequest,
      sourceLang: "auto",
    });
    const sys = msgs[0].content as string;
    expect(sys.toLowerCase()).toContain("detect");
  });

  it('system message contains "source language: X" when sourceLang is specific', () => {
    const msgs = buildTranslationMessages({ ...baseRequest, sourceLang: "en" });
    const sys = msgs[0].content as string;
    expect(sys.toLowerCase()).toContain("source language: en");
    expect(sys.toLowerCase()).not.toContain("detect");
  });

  it("system message contains glossary terms when glossary enabled + populated", () => {
    const request: TranslationRequest = {
      ...baseRequest,
      glossary: {
        enabled: true,
        entries: [
          { id: "1", source: "RAG", target: "검색 증강 생성" },
          { id: "2", source: "LLM", target: "대형 언어 모델" },
        ],
      },
    };
    const sys = buildTranslationMessages(request)[0].content as string;
    expect(sys).toContain("RAG");
    expect(sys).toContain("검색 증강 생성");
    expect(sys).toContain("LLM");
    expect(sys).toContain("대형 언어 모델");
  });

  it("system message does NOT contain glossary clause when glossary disabled", () => {
    const request: TranslationRequest = {
      ...baseRequest,
      glossary: {
        enabled: false,
        entries: [{ id: "1", source: "RAG", target: "검색 증강 생성" }],
      },
    };
    const sys = buildTranslationMessages(request)[0].content as string;
    expect(sys).not.toContain("RAG");
    expect(sys).not.toMatch(/always translate these terms/i);
  });

  it("system message does NOT contain glossary clause when glossary enabled but empty", () => {
    const request: TranslationRequest = {
      ...baseRequest,
      glossary: { enabled: true, entries: [] },
    };
    const sys = buildTranslationMessages(request)[0].content as string;
    expect(sys).not.toMatch(/always translate these terms/i);
  });

  it("system message does NOT contain glossary clause when glossary is undefined", () => {
    const sys = buildTranslationMessages(baseRequest)[0].content as string;
    expect(sys).not.toMatch(/always translate these terms/i);
  });

  it("system message contains customPrompt when provided", () => {
    const request: TranslationRequest = {
      ...baseRequest,
      customPrompt: "비즈니스 격식체를 유지해라",
    };
    const sys = buildTranslationMessages(request)[0].content as string;
    expect(sys).toContain("비즈니스 격식체를 유지해라");
    expect(sys.toLowerCase()).toMatch(/additional instruction/);
  });

  it("system message does NOT contain customPrompt clause when not provided", () => {
    const sys = buildTranslationMessages(baseRequest)[0].content as string;
    expect(sys.toLowerCase()).not.toMatch(/additional instruction/);
  });

  it("system message contains PDF reconstruction clause when cleanSourceText is true", () => {
    const sys = buildTranslationMessages({
      ...baseRequest,
      cleanSourceText: true,
    })[0].content as string;
    expect(sys.toLowerCase()).toMatch(/reconstruct/);
    expect(sys).not.toMatch(/Preserve emojis/i);
  });

  it("system message contains standard preserve-formatting clause when cleanSourceText is false", () => {
    const sys = buildTranslationMessages({
      ...baseRequest,
      cleanSourceText: false,
    })[0].content as string;
    expect(sys).toMatch(/Preserve emojis, hashtags/i);
  });

  it("system message contains standard preserve-formatting clause when cleanSourceText is undefined", () => {
    const sys = buildTranslationMessages(baseRequest)[0].content as string;
    expect(sys).toMatch(/Preserve emojis, hashtags/i);
  });

  it("user message equals sourceText", () => {
    const msgs = buildTranslationMessages(baseRequest);
    expect(msgs[1].content).toBe(baseRequest.sourceText);
  });
});

describe("streamTranslation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    constructorCalls.length = 0;
  });

  it("calls chat.completions.create with the request model and messages", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
    await streamTranslation(baseRequest, baseProvider);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.model).toBe("gpt-5.4-mini");
    expect(callArg.stream).toBe(true);
    expect(callArg.messages).toHaveLength(2);
  });

  it("uses the fixed 0.3 temperature (managed presets — no per-provider override)", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
    await streamTranslation(baseRequest, baseProvider);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.temperature).toBe(0.3);
  });

  it("streams chunks as SSE-encoded lines and ends with data: [DONE]", async () => {
    mockCreate.mockResolvedValueOnce(
      makeAsyncIterable([
        { choices: [{ delta: { content: "안녕" } }] },
        { choices: [{ delta: { content: "하세요" } }] },
      ]),
    );
    const stream = await streamTranslation(baseRequest, baseProvider);
    const out = await collectStream(stream);
    expect(out).toContain("data: 안녕\n\n");
    expect(out).toContain("data: 하세요\n\n");
    expect(out.endsWith("data: [DONE]\n\n")).toBe(true);
  });

  it("splits multi-line delta content into separate SSE events", async () => {
    mockCreate.mockResolvedValueOnce(
      makeAsyncIterable([
        { choices: [{ delta: { content: "line1\nline2" } }] },
      ]),
    );
    const stream = await streamTranslation(baseRequest, baseProvider);
    const out = await collectStream(stream);
    expect(out).toContain("data: line1\n\n");
    expect(out).toContain("data: line2\n\n");
  });

  it("builds the OpenAI client with the resolved provider's apiKey + baseURL", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
    await streamTranslation(baseRequest, baseProvider);
    expect(constructorCalls).toHaveLength(1);
    expect(constructorCalls[0].apiKey).toBe("sk-test-123");
    expect(constructorCalls[0].baseURL).toBe("https://api.openai.com/v1");
  });

  it("propagates errors from the underlying stream via controller.error", async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: "a" } }] };
        throw new Error("upstream failure");
      })(),
    );
    const stream = await streamTranslation(baseRequest, baseProvider);
    const reader = stream.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    expect(first.value).toBeDefined();
    expect(first.value?.byteLength).toBeGreaterThan(0);
    await expect(reader.read()).rejects.toThrow(/upstream failure/);
  });
});
