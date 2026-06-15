import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { translateAction } from "./translateAction";
import type { TranslationRequest } from "$lib/schemas";

const baseRequest: TranslationRequest = {
  sourceText: "hello",
  sourceLang: "auto",
  targetLang: "ko",
  providerId: "openai",
  apiKey: "sk-test",
  model: "gpt-5.4-mini",
};

function sseResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("translateAction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams chunks to onChunk and finalizes with onDone", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      sseResponse("data: 안\n\ndata: 녕\n\ndata: [DONE]\n\n"),
    );

    const chunks: { text: string; accumulated: string }[] = [];
    let doneText: string | undefined;
    let errored = false;

    await translateAction(baseRequest, {
      onChunk: (text, accumulated) => chunks.push({ text, accumulated }),
      onDone: (fullText) => {
        doneText = fullText;
      },
      onError: () => {
        errored = true;
      },
    });

    expect(chunks).toEqual([
      { text: "안", accumulated: "안" },
      { text: "녕", accumulated: "안녕" },
    ]);
    expect(doneText).toBe("안녕");
    expect(errored).toBe(false);
  });

  it("invokes onError on HTTP error with parsed JSON body", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "INVALID_API_KEY", message: "API 키 오류" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const errors: { error: string; message: string }[] = [];
    let done = false;
    await translateAction(baseRequest, {
      onError: (error, message) => errors.push({ error, message }),
      onDone: () => {
        done = true;
      },
    });

    expect(errors).toEqual([
      { error: "INVALID_API_KEY", message: "API 키 오류" },
    ]);
    expect(done).toBe(false);
  });

  it("invokes onError with a fallback when HTTP error body is not JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("internal error", { status: 500 }),
    );

    const errors: { error: string; message: string }[] = [];
    await translateAction(baseRequest, {
      onError: (error, message) => errors.push({ error, message }),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].error).toBe("UNKNOWN");
    expect(errors[0].message.length).toBeGreaterThan(0);
  });

  it("invokes onError on a mid-stream error event", async () => {
    const payload = JSON.stringify({
      error: "STREAM_INTERRUPTED",
      message: "중단됨",
    });
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      sseResponse(`data: partial\n\nevent: error\ndata: ${payload}\n\n`),
    );

    const chunks: string[] = [];
    const errors: { error: string; message: string }[] = [];
    let done = false;
    await translateAction(baseRequest, {
      onChunk: (_text, accumulated) => chunks.push(accumulated),
      onError: (error, message) => errors.push({ error, message }),
      onDone: () => {
        done = true;
      },
    });

    expect(chunks).toEqual(["partial"]);
    expect(errors).toEqual([
      { error: "STREAM_INTERRUPTED", message: "중단됨" },
    ]);
    expect(done).toBe(false);
  });

  it("passes the AbortSignal through to fetch", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseResponse("data: [DONE]\n\n"));

    const controller = new AbortController();
    await translateAction(baseRequest, {}, controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });

  it("does NOT call onError when the fetch is aborted (user-initiated cancel)", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    let errored = false;
    let done = false;
    await translateAction(baseRequest, {
      onError: () => {
        errored = true;
      },
      onDone: () => {
        done = true;
      },
    });

    expect(errored).toBe(false);
    expect(done).toBe(false);
  });

  it("calls onError with NETWORK_ERROR when fetch fails for non-abort reasons", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const errors: { error: string; message: string }[] = [];
    await translateAction(baseRequest, {
      onError: (error, message) => errors.push({ error, message }),
    });

    expect(errors).toEqual([
      { error: "NETWORK_ERROR", message: expect.any(String) },
    ]);
  });

  it("handles a stream that ends with [DONE] but no chunks (empty translation)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      sseResponse("data: [DONE]\n\n"),
    );

    const chunks: string[] = [];
    let doneText: string | undefined;
    await translateAction(baseRequest, {
      onChunk: (_text, accumulated) => chunks.push(accumulated),
      onDone: (fullText) => {
        doneText = fullText;
      },
    });

    expect(chunks).toEqual([]);
    expect(doneText).toBe("");
  });

  it("sends the request body as JSON with POST", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(sseResponse("data: [DONE]\n\n"));

    await translateAction(baseRequest, {});

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/translate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual(baseRequest);
  });
});
