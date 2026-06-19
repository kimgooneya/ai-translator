import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── OpenAI SDK mock (unchanged shape) ────────────────────────────────────
const { mockCreate, constructorCalls, MockOpenAI, MockAPIError } = vi.hoisted(
  () => {
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
    class MockAPIError extends Error {
      readonly status: number | undefined;
      readonly error: unknown;
      readonly headers: unknown;
      constructor(
        status: number | undefined,
        message: string,
        error: unknown = undefined,
        headers: unknown = undefined,
      ) {
        super(message);
        this.name = "APIError";
        this.status = status;
        this.error = error;
        this.headers = headers;
      }
    }
    return { mockCreate, constructorCalls, MockOpenAI, MockAPIError };
  },
);

vi.mock("openai", () => ({
  default: MockOpenAI,
  APIError: MockAPIError,
}));

// ─── provider-keys mock: resolve preset + decrypted key without a DB ──────
const {
  mockGetEnabledPreset,
  mockResolveActiveKey,
  NoActiveKeyError,
  KeyDecryptionError,
} = vi.hoisted(() => {
  class NoActiveKeyError extends Error {
    readonly providerId: string;
    constructor(providerId: string) {
      super(`No active API key for provider "${providerId}"`);
      this.name = "NoActiveKeyError";
      this.providerId = providerId;
    }
  }
  class KeyDecryptionError extends Error {
    readonly providerId: string;
    constructor(providerId: string) {
      super(`Failed to decrypt stored key for provider "${providerId}"`);
      this.name = "KeyDecryptionError";
      this.providerId = providerId;
    }
  }
  return {
    mockGetEnabledPreset: vi.fn(),
    mockResolveActiveKey: vi.fn(),
    NoActiveKeyError,
    KeyDecryptionError,
  };
});

vi.mock("$lib/server/provider-keys", () => ({
  getEnabledPreset: mockGetEnabledPreset,
  resolveActiveKey: mockResolveActiveKey,
  NoActiveKeyError,
  KeyDecryptionError,
}));

// ─── supabase-admin mock: usage_logs insert is a captured no-op ───────────
const { mockInsert } = vi.hoisted(() => ({
  mockInsert: vi.fn(),
}));
vi.mock("$lib/server/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({ from: () => ({ insert: mockInsert }) }),
}));

// Imported AFTER vi.mock so modules are replaced before +server captures them.
import { POST } from "./+server";

type TranslateRequestEvent = Parameters<typeof POST>[0];
const ENDPOINT_URL = "http://localhost/api/translate";

function makeAsyncIterable(
  chunks: Array<{ choices: Array<{ delta: { content?: string } }> }>,
) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    },
  };
}

const profile = {
  id: "user-uuid-1",
  email: "test@test.com",
  name: null,
  avatar_url: null,
  role: "user" as const,
  status: "active" as const,
  created_at: "",
};

function makeEvent(body: unknown): TranslateRequestEvent {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const request = new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });
  return {
    request,
    url: new URL(ENDPOINT_URL),
    locals: {
      user: { id: "user-uuid-1" },
      profile,
      supabase: {} as never,
      session: null,
    },
  } as unknown as TranslateRequestEvent;
}

function makeMalformedJsonEvent(): TranslateRequestEvent {
  const request = new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-valid-json{",
  });
  return {
    request,
    url: new URL(ENDPOINT_URL),
    locals: {
      user: { id: "user-uuid-1" },
      profile,
      supabase: {} as never,
      session: null,
    },
  } as unknown as TranslateRequestEvent;
}

// apiKey-less request body (managed-key model).
const validRequest = {
  sourceText: "Hello, world!",
  sourceLang: "auto",
  targetLang: "ko",
  providerId: "openai",
  model: "gpt-5.4-mini",
};

const openaiPreset = {
  id: "openai",
  display_name: "OpenAI",
  base_url: "https://api.openai.com/v1",
  models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  default_model: "gpt-5.4-mini",
  enabled: true,
  sort_order: 1,
  created_at: "",
  updated_at: "",
  updated_by: null,
};

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

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

/** Flush fire-and-forget usage_logs insert microtasks. */
function flushFireAndForget(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("POST /api/translate", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    constructorCalls.length = 0;
    mockInsert.mockReset();
    mockInsert.mockResolvedValue({ error: null });
    mockGetEnabledPreset.mockReset();
    mockResolveActiveKey.mockReset();
    // Default happy-path DB state: openai preset present, one decrypted key.
    mockGetEnabledPreset.mockResolvedValue(openaiPreset);
    mockResolveActiveKey.mockResolvedValue("sk-decrypted-managed-key");
  });

  describe("validation", () => {
    it("returns 400 INVALID_REQUEST on malformed JSON body", async () => {
      const response = await POST(makeMalformedJsonEvent());
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_REQUEST when sourceText is empty", async () => {
      const response = await POST(
        makeEvent({ ...validRequest, sourceText: "" }),
      );
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_REQUEST when model is missing", async () => {
      const { model: _omit, ...noModel } = validRequest;
      void _omit;
      const response = await POST(makeEvent(noModel));
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_REQUEST when the preset is unknown/disabled", async () => {
      mockGetEnabledPreset.mockResolvedValue(null);
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockResolveActiveKey).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_REQUEST when the model is not in the preset", async () => {
      const response = await POST(
        makeEvent({ ...validRequest, model: "not-a-real-model" }),
      );
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockResolveActiveKey).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 401 INVALID_REQUEST when no authenticated session/profile", async () => {
      const request = new Request(ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validRequest),
      });
      const event = {
        request,
        url: new URL(ENDPOINT_URL),
        locals: {
          user: null,
          profile: null,
          supabase: {} as never,
          session: null,
        },
      } as unknown as TranslateRequestEvent;
      const response = await POST(event);
      expect(response.status).toBe(401);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockGetEnabledPreset).not.toHaveBeenCalled();
    });
  });

  describe("managed-key resolution", () => {
    it("returns 401 INVALID_API_KEY when no active key is registered", async () => {
      mockResolveActiveKey.mockRejectedValueOnce(
        new NoActiveKeyError("openai"),
      );
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(401);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("INVALID_API_KEY");
      expect(body.message).toBe("이 provider에 등록된 API 키가 없습니다");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("maps a decryption failure to 500 PROVIDER_ERROR (no key details)", async () => {
      mockResolveActiveKey.mockRejectedValueOnce(
        new KeyDecryptionError("openai"),
      );
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(500);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("PROVIDER_ERROR");
      // Must not leak the key, provider id, or crypto specifics.
      expect(body.message).not.toMatch(/sk-|encrypted|key/i);
    });
  });

  describe("successful streaming", () => {
    it("returns 200 + text/event-stream with SSE chunks and [DONE] terminator", async () => {
      mockCreate.mockResolvedValueOnce(
        makeAsyncIterable([
          { choices: [{ delta: { content: "안녕" } }] },
          { choices: [{ delta: { content: "하세요" } }] },
        ]),
      );

      const response = await POST(makeEvent(validRequest));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe("no-cache");
      expect(response.headers.get("Connection")).toBe("keep-alive");
      expect(response.body).toBeInstanceOf(ReadableStream);

      const out = await collectStream(response.body!);
      expect(out).toContain("data: 안녕\n\n");
      expect(out).toContain("data: 하세요\n\n");
      expect(out.endsWith("data: [DONE]\n\n")).toBe(true);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.model).toBe("gpt-5.4-mini");
      expect(callArg.stream).toBe(true);
    });

    it("builds the OpenAI client with the DECRYPTED managed key + DB baseURL", async () => {
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      await POST(makeEvent(validRequest));
      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0].apiKey).toBe("sk-decrypted-managed-key");
      expect(constructorCalls[0].baseURL).toBe("https://api.openai.com/v1");
    });

    it("does NOT set Access-Control-Allow-Origin (same-origin only)", async () => {
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      const response = await POST(makeEvent(validRequest));
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("inserts a usage_logs row (status ok) on stream completion", async () => {
      mockCreate.mockResolvedValueOnce(
        makeAsyncIterable([
          { choices: [{ delta: { content: "안녕하세요" } }] },
        ]),
      );
      await collectStream((await POST(makeEvent(validRequest))).body!);
      await flushFireAndForget();

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const payload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        user_id: "user-uuid-1",
        provider_id: "openai",
        model: "gpt-5.4-mini",
        source_lang: "auto",
        target_lang: "ko",
        input_chars: validRequest.sourceText.length,
        output_chars: 5, // "안녕하세요"
        status: "ok",
      });
      expect(payload.error_code).toBeNull();
      expect(payload.duration_ms).toBeTypeOf("number");
    });
  });

  describe("provider error mapping (pre-stream)", () => {
    it("maps an OpenAI 401 to 401 INVALID_API_KEY", async () => {
      mockCreate.mockRejectedValueOnce(
        new MockAPIError(401, "Incorrect API key provided"),
      );
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(401);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("INVALID_API_KEY");
      expect(body.message).toBe("API 키를 확인하세요");
    });

    it("maps an OpenAI 429 to 429 RATE_LIMITED", async () => {
      mockCreate.mockRejectedValueOnce(
        new MockAPIError(429, "Rate limit reached"),
      );
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(429);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("RATE_LIMITED");
    });

    it("maps a generic OpenAI 500 to 500 PROVIDER_ERROR", async () => {
      mockCreate.mockRejectedValueOnce(
        new MockAPIError(500, "Internal server error"),
      );
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(500);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("PROVIDER_ERROR");
    });

    it("maps a non-APIError to 500 PROVIDER_ERROR", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network failure"));
      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(500);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("PROVIDER_ERROR");
    });
  });

  describe("mid-stream error handling", () => {
    it("emits a STREAM_INTERRUPTED SSE error event when the inner stream errors mid-flight", async () => {
      mockCreate.mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: "partial" } }] };
          throw new Error("upstream connection dropped");
        })(),
      );

      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      const out = await collectStream(response.body!);
      expect(out).toContain("data: partial\n\n");
      expect(out).toContain("event: error");
      expect(out).toContain("STREAM_INTERRUPTED");
      expect(out).toContain("upstream connection dropped");
    });

    it("inserts a usage_logs row (status error) on a mid-stream failure", async () => {
      mockCreate.mockResolvedValueOnce(
        (async function* () {
          yield { choices: [{ delta: { content: "partial" } }] };
          throw new Error("upstream connection dropped");
        })(),
      );
      await collectStream((await POST(makeEvent(validRequest))).body!);
      await flushFireAndForget();

      expect(mockInsert).toHaveBeenCalledTimes(1);
      const payload = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.status).toBe("error");
      expect(payload.error_code).toBe("STREAM_INTERRUPTED");
      expect(payload.output_chars).toBe(7); // "partial"
    });
  });
});
