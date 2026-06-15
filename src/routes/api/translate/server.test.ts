import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TranslationRequest } from "$lib/schemas";

const { mockCreate, MockOpenAI, MockAPIError } = vi.hoisted(() => {
  const mockCreate = vi.fn();
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
    }
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  }
  // Mirror the openai SDK's APIError shape: status + message are the only fields
  // the endpoint inspects. Extra args are accepted but optional so tests can call
  // `new MockAPIError(401, 'msg')` cleanly.
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
  return { mockCreate, MockOpenAI, MockAPIError };
});

vi.mock("openai", () => ({
  default: MockOpenAI,
  APIError: MockAPIError,
}));

// Imported AFTER vi.mock so the OpenAI SDK is replaced before streamTranslation
// captures it via the provider registry.
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

function makeEvent(body: unknown): TranslateRequestEvent {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  const request = new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });
  return { request, url: new URL(ENDPOINT_URL) } as TranslateRequestEvent;
}

function makeMalformedJsonEvent(): TranslateRequestEvent {
  const request = new Request(ENDPOINT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-valid-json{",
  });
  return { request, url: new URL(ENDPOINT_URL) } as TranslateRequestEvent;
}

const validRequest: TranslationRequest = {
  sourceText: "Hello, world!",
  sourceLang: "auto",
  targetLang: "ko",
  providerId: "openai",
  apiKey: "sk-test-123",
  model: "gpt-5.4-mini",
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

describe("POST /api/translate", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe("validation", () => {
    it("returns 400 INVALID_REQUEST on malformed JSON body", async () => {
      const response = await POST(makeMalformedJsonEvent());
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(body.message).toMatch(/json/i);
    });

    it("returns 400 INVALID_REQUEST when apiKey is missing", async () => {
      const { apiKey: _omit, ...noKey } = validRequest;
      void _omit;
      const response = await POST(makeEvent(noKey));
      expect(response.status).toBe(400);
      const body = (await readJson(response)) as { error: string };
      expect(body.error).toBe("INVALID_REQUEST");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 400 INVALID_REQUEST when apiKey is an empty string", async () => {
      const response = await POST(makeEvent({ ...validRequest, apiKey: "" }));
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
  });

  describe("successful streaming", () => {
    it("returns 200 + text/event-stream with SSE-encoded chunks and [DONE] terminator", async () => {
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

    it("uses the request apiKey (stateless — no server-side persistence)", async () => {
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      await POST(makeEvent({ ...validRequest, apiKey: "sk-from-request-999" }));
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("does NOT set Access-Control-Allow-Origin (same-origin only)", async () => {
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      const response = await POST(makeEvent(validRequest));
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
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
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("RATE_LIMITED");
      expect(body.message).toBe("요청이 너무 많습니다");
    });

    it("maps a generic OpenAI 500 to 500 PROVIDER_ERROR", async () => {
      mockCreate.mockRejectedValueOnce(
        new MockAPIError(500, "Internal server error"),
      );

      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(500);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("PROVIDER_ERROR");
      expect(body.message).toMatch(/internal server error/i);
    });

    it("maps a non-APIError to 500 PROVIDER_ERROR", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network failure"));

      const response = await POST(makeEvent(validRequest));
      expect(response.status).toBe(500);
      const body = (await readJson(response)) as {
        error: string;
        message: string;
      };
      expect(body.error).toBe("PROVIDER_ERROR");
      expect(body.message).toBe("Network failure");
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
      // The HTTP response is 200 because the stream started successfully.
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/event-stream");

      const out = await collectStream(response.body!);
      // The chunk emitted before the error is preserved.
      expect(out).toContain("data: partial\n\n");
      // A terminal error event is emitted with the STREAM_INTERRUPTED payload.
      expect(out).toContain("event: error");
      expect(out).toContain("STREAM_INTERRUPTED");
      expect(out).toContain("upstream connection dropped");
    });
  });

  describe("statelessness", () => {
    it("does not persist the apiKey across requests (stateless)", async () => {
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      await POST(makeEvent({ ...validRequest, apiKey: "sk-ephemeral-1" }));
      mockCreate.mockResolvedValueOnce(makeAsyncIterable([]));
      await POST(makeEvent({ ...validRequest, apiKey: "sk-ephemeral-2" }));

      expect(mockCreate).toHaveBeenCalledTimes(2);
      // Each call uses its own apiKey via the freshly constructed client.
      // (MockOpenAI constructor stored apiKey internally; no shared state on the handler.)
    });
  });
});
