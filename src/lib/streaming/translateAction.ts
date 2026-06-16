/**
 * High-level orchestration for the translate flow.
 *
 * Wraps `fetch('/api/translate')` + {@link consumeTranslationStream} into a
 * callback-driven action so the Svelte component can update UI state
 * (`resultText`, `errorMessage`) on each chunk without dealing with SSE
 * framing or HTTP error mapping.
 *
 * Design notes:
 *   - The fetch is performed here (not in the component) so that the same
 *     action can be reused by tests and other callers with a single entry
 *     point.
 *   - Callbacks are optional; callers only pay attention to the events
 *     they care about.
 *   - AbortError is swallowed (treated as a successful cancel) so the
 *     component's cancel button does not surface as an error.
 */

import { consumeTranslationStream } from "./consumeTranslationStream";
import type { TranslationRequest } from "$lib/schemas";
import { t } from "$lib/i18n";

export interface TranslateCallbacks {
  /** Called for every text chunk. `accumulated` is the full text so far. */
  onChunk?: (text: string, accumulated: string) => void;
  /** Called when the server reports an error (HTTP or mid-stream). */
  onError?: (error: string, message: string) => void;
  /** Called once when the stream completes successfully. */
  onDone?: (fullText: string) => void;
}

/**
 * Execute a translation request end-to-end.
 *
 * @returns Resolves when the stream finishes (done, error, or abort).
 *   Rejects only on unexpected exceptions (network failure that isn't an
 *   AbortError) — callers should still wrap this in try/catch for safety.
 */
export async function translateAction(
  request: TranslationRequest,
  callbacks: TranslateCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    // User cancelled before/during the fetch — keep partial result,
    // do not surface as error.
    if (err instanceof DOMException && err.name === "AbortError") return;
    callbacks.onError?.("NETWORK_ERROR", t("errors.NETWORK_ERROR"));
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({
      error: "UNKNOWN",
      message: t("errors.UNKNOWN"),
    }));
    callbacks.onError?.(
      err.error ?? "UNKNOWN",
      err.message ?? t("errors.UNKNOWN"),
    );
    return;
  }

  let accumulated = "";
  try {
    for await (const event of consumeTranslationStream(response, signal)) {
      if (event.type === "chunk") {
        accumulated += event.text;
        callbacks.onChunk?.(event.text, accumulated);
      } else if (event.type === "error") {
        callbacks.onError?.(event.error, event.message);
        return;
      } else if (event.type === "done") {
        callbacks.onDone?.(accumulated);
        return;
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    callbacks.onError?.("STREAM_INTERRUPTED", t("errors.STREAM_INTERRUPTED"));
  }
}
