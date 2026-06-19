import { describe, it, expect, vi } from "vitest";

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

import { createProviderClient } from "./registry";

describe("createProviderClient", () => {
  it("returns an OpenAI client instance", () => {
    const client = createProviderClient(
      "sk-test-123",
      "https://api.openai.com/v1",
    );
    expect(client).toBeDefined();
    expect(typeof client.chat.completions.create).toBe("function");
  });

  it("passes apiKey and baseURL to the OpenAI constructor", () => {
    constructorCalls.length = 0;
    createProviderClient("sk-test-123", "https://api.openai.com/v1");
    expect(constructorCalls).toHaveLength(1);
    expect(constructorCalls[0].apiKey).toBe("sk-test-123");
    expect(constructorCalls[0].baseURL).toBe("https://api.openai.com/v1");
  });

  it("forces dangerouslyAllowBrowser=false (server-side only)", () => {
    constructorCalls.length = 0;
    createProviderClient("sk-test-123", "https://api.openai.com/v1");
    expect(constructorCalls[0].dangerouslyAllowBrowser).toBe(false);
  });

  it("forwards a custom baseURL (e.g. Gemini OpenAI-compatible endpoint)", () => {
    constructorCalls.length = 0;
    createProviderClient(
      "gem-key",
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
    expect(constructorCalls[0].baseURL).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
    expect(constructorCalls[0].apiKey).toBe("gem-key");
  });
});
