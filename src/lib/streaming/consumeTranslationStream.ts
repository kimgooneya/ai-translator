/**
 * SSE stream consumer for the `/api/translate` endpoint.
 *
 * Wire format (produced by `src/routes/api/translate/+server.ts`):
 *   - Text chunk:    `data: <text>\n\n`
 *   - Stream end:    `data: [DONE]\n\n`
 *   - Mid-stream err:`event: error\ndata: {"error":"...","message":"..."}\n\n`
 *
 * The generator yields parsed {@link StreamEvent}s so callers can render
 * incrementally without re-implementing SSE framing. Multi-line `data:`
 * blocks are joined with `\n` per the SSE spec.
 */

export type StreamEvent =
  | { type: "chunk"; text: string }
  | { type: "error"; error: string; message: string }
  | { type: "done" };

/**
 * Parse a single raw SSE event (the bytes between two `\n\n` boundaries)
 * into a {@link StreamEvent}, or `null` if the event carries no payload.
 */
function parseEvent(rawEvent: string): StreamEvent | null {
  const lines = rawEvent.split("\n");
  let eventType = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  const data = dataLines.join("\n");

  if (eventType === "error") {
    try {
      const parsed = JSON.parse(data) as { error?: string; message?: string };
      return {
        type: "error",
        error: parsed.error ?? "UNKNOWN",
        message: parsed.message ?? "",
      };
    } catch {
      // Malformed error payload — surface as a generic error so the UI
      // can react instead of silently hanging.
      return { type: "error", error: "UNKNOWN", message: data };
    }
  }

  if (data === "[DONE]") {
    return { type: "done" };
  }

  if (data === "") {
    // Empty data line / keep-alive comment — nothing to render.
    return null;
  }

  return { type: "chunk", text: data };
}

/**
 * Consume a fetch `Response` body as a stream of {@link StreamEvent}s.
 *
 * Aborts cleanly when `signal` is aborted: the underlying reader is
 * cancelled and the generator returns without yielding further events.
 * Already-yielded chunks remain visible to the caller, so partial results
 * are preserved on user-initiated cancellation.
 */
export async function* consumeTranslationStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. `\n\n` is the canonical
      // separator; tolerate trailing data when the stream closes without
      // a final separator by flushing whatever remains after the loop.
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n\n")) >= 0) {
        const rawEvent = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 2);
        const event = parseEvent(rawEvent);
        if (!event) continue;
        yield event;
        // An error or done event terminates the logical stream.
        if (event.type === "error" || event.type === "done") {
          return;
        }
      }
    }

    // Flush any trailing event that wasn't terminated by `\n\n` (e.g. when
    // the server closes the connection without a final separator).
    if (buffer.trim() !== "") {
      const event = parseEvent(buffer.trim());
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
