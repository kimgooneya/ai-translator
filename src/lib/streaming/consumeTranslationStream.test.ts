import { describe, it, expect } from "vitest";
import { consumeTranslationStream } from "./consumeTranslationStream";

/** Build a Response whose body is the given raw SSE string. */
function sseResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Build a Response whose body is a controllable ReadableStream. */
function streamResponse(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function drain(response: Response, signal?: AbortSignal) {
  const out: {
    type: string;
    text?: string;
    error?: string;
    message?: string;
  }[] = [];
  for await (const ev of consumeTranslationStream(response, signal)) {
    out.push(ev);
  }
  return out;
}

describe("consumeTranslationStream", () => {
  it("yields a single chunk", async () => {
    const events = await drain(sseResponse("data: hello\n\n"));
    expect(events).toEqual([{ type: "chunk", text: "hello" }]);
  });

  it("yields multiple chunks in order", async () => {
    const events = await drain(
      sseResponse("data: 안\n\ndata: 녕\n\ndata: 하세요\n\n"),
    );
    expect(events).toEqual([
      { type: "chunk", text: "안" },
      { type: "chunk", text: "녕" },
      { type: "chunk", text: "하세요" },
    ]);
  });

  it("yields a done event on [DONE] marker", async () => {
    const events = await drain(sseResponse("data: hi\n\ndata: [DONE]\n\n"));
    expect(events).toEqual([{ type: "chunk", text: "hi" }, { type: "done" }]);
  });

  it("yields a done event for a bare [DONE] stream", async () => {
    const events = await drain(sseResponse("data: [DONE]\n\n"));
    expect(events).toEqual([{ type: "done" }]);
  });

  it("yields an error event with parsed payload", async () => {
    const payload = JSON.stringify({
      error: "STREAM_INTERRUPTED",
      message: "번역이 중단되었습니다",
    });
    const events = await drain(
      sseResponse(`event: error\ndata: ${payload}\n\n`),
    );
    expect(events).toEqual([
      {
        type: "error",
        error: "STREAM_INTERRUPTED",
        message: "번역이 중단되었습니다",
      },
    ]);
  });

  it("preserves chunks received before the error event", async () => {
    const payload = JSON.stringify({
      error: "STREAM_INTERRUPTED",
      message: "boom",
    });
    const events = await drain(
      sseResponse(`data: partial\n\nevent: error\ndata: ${payload}\n\n`),
    );
    expect(events).toEqual([
      { type: "chunk", text: "partial" },
      { type: "error", error: "STREAM_INTERRUPTED", message: "boom" },
    ]);
  });

  it("stops the generator after an error event", async () => {
    const payload = JSON.stringify({ error: "X", message: "y" });
    const events = await drain(
      sseResponse(
        `event: error\ndata: ${payload}\n\ndata: should-not-arrive\n\n`,
      ),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
  });

  it("stops the generator after the done event", async () => {
    const events = await drain(
      sseResponse("data: [DONE]\n\ndata: should-not-arrive\n\n"),
    );
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("done");
  });

  it("ignores empty data lines", async () => {
    const events = await drain(sseResponse("data: \n\ndata: real\n\n"));
    expect(events).toEqual([{ type: "chunk", text: "real" }]);
  });

  it("joins multi-line data with \\n", async () => {
    const events = await drain(sseResponse("data: line1\ndata: line2\n\n"));
    expect(events).toEqual([{ type: "chunk", text: "line1\nline2" }]);
  });

  it("handles chunked byte delivery across event boundaries", async () => {
    const encoder = new TextEncoder();
    // Split "data: A\n\ndata: B\n\n" across arbitrary byte boundaries.
    const full = "data: A\n\ndata: B\n\n";
    const chunks = [
      encoder.encode(full.slice(0, 5)),
      encoder.encode(full.slice(5, 9)),
      encoder.encode(full.slice(9)),
    ];
    const events = await drain(streamResponse(chunks));
    expect(events).toEqual([
      { type: "chunk", text: "A" },
      { type: "chunk", text: "B" },
    ]);
  });

  it("flushes a trailing event without \\n\\n terminator", async () => {
    const events = await drain(sseResponse("data: trailing"));
    expect(events).toEqual([{ type: "chunk", text: "trailing" }]);
  });

  it("throws when response.body is null", async () => {
    const response = new Response(null, { status: 200 });
    await expect(drain(response)).rejects.toThrow("No response body");
  });

  describe("AbortSignal", () => {
    it("cancels cleanly when aborted before any read", async () => {
      let cancelCalled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          // Never enqueue; never close — simulates a slow producer.
          void controller;
        },
        cancel() {
          cancelCalled = true;
        },
      });
      const response = new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

      const controller = new AbortController();
      controller.abort();

      const events = await drain(response, controller.signal);
      expect(events).toEqual([]);
      expect(cancelCalled).toBe(true);
    });

    it("stops after abort and preserves previously yielded chunks", async () => {
      const encoder = new TextEncoder();
      let cancelCalled = false;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("data: partial\n\n"));
        },
        cancel() {
          cancelCalled = true;
        },
      });
      const response = new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

      const controller = new AbortController();
      // Abort AFTER we have already enqueued the first chunk so the
      // generator yields it before noticing the abort on the next loop.
      const events: { type: string; text?: string }[] = [];
      for await (const ev of consumeTranslationStream(
        response,
        controller.signal,
      )) {
        events.push(ev);
        controller.abort();
      }
      expect(events).toEqual([{ type: "chunk", text: "partial" }]);
      expect(cancelCalled).toBe(true);
    });
  });

  describe("malformed payloads", () => {
    it("treats a malformed error JSON payload as a generic error", async () => {
      const events = await drain(
        sseResponse("event: error\ndata: not-json\n\n"),
      );
      expect(events).toEqual([
        { type: "error", error: "UNKNOWN", message: "not-json" },
      ]);
    });

    it("ignores comment lines and unknown event fields", async () => {
      // `: comment` is a keep-alive comment in SSE; `id:` is unused here.
      const events = await drain(sseResponse(": keepalive\n\ndata: real\n\n"));
      expect(events).toEqual([{ type: "chunk", text: "real" }]);
    });
  });
});
