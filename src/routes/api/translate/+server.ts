import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { APIError } from "openai";
import {
  translationRequestSchema,
  type Settings,
  type TranslationRequest,
} from "$lib/schemas";
import { streamTranslation } from "$lib/providers/translate";

/**
 * Build a minimal `Settings` object from a validated `TranslationRequest`.
 *
 * RATIONALE (Option B from the task spec):
 * The existing `streamTranslation(request, settings)` requires a `Settings` instance
 * to (a) find a matching `ProviderConfig` and (b) resolve the provider definition
 * (incl. baseURL) via `getProviderById`. For the stateless `/api/translate` endpoint
 * we have no server-side settings store — the request body already carries
 * `apiKey`, `model`, and `providerId`. We synthesize a single-provider `Settings`
 * so `streamTranslation` works unchanged (no refactor, no broken existing tests).
 *
 * Preset providerIds resolve baseURL from `PRESET_PROVIDERS` automatically.
 * Unknown providerIds will trigger streamTranslation's `Provider not registered`
 * error, which the caller maps to 400 INVALID_REQUEST.
 */
function buildSettingsFromRequest(req: TranslationRequest): Settings {
  return {
    providers: [
      {
        providerId: req.providerId,
        apiKey: req.apiKey,
        selectedModel: req.model,
      },
    ],
    activeProviderId: req.providerId,
    defaultTargetLang: req.targetLang,
  };
}

type ErrorBody = { error: string; message: string };
type ErrorResponse = { status: number; body: ErrorBody };

function invalidRequest(message: string): ErrorResponse {
  return { status: 400, body: { error: "INVALID_REQUEST", message } };
}

/**
 * Map an error thrown by `streamTranslation` (or the OpenAI SDK) to an HTTP error
 * response. Pre-stream errors (e.g. 401 / 429 on the initial request) land here;
 * mid-stream errors are handled separately by `wrapStreamWithErrorHandling`.
 */
function mapProviderError(err: unknown): ErrorResponse {
  if (err instanceof APIError) {
    if (err.status === 401) {
      return {
        status: 401,
        body: { error: "INVALID_API_KEY", message: "API 키를 확인하세요" },
      };
    }
    if (err.status === 429) {
      return {
        status: 429,
        body: { error: "RATE_LIMITED", message: "요청이 너무 많습니다" },
      };
    }
    return {
      status: 500,
      body: { error: "PROVIDER_ERROR", message: err.message },
    };
  }
  // streamTranslation throws plain `Error` for unknown provider ids.
  if (
    err instanceof Error &&
    /not registered|not found in settings/i.test(err.message)
  ) {
    return invalidRequest(err.message);
  }
  const message = err instanceof Error ? err.message : "Unknown provider error";
  return { status: 500, body: { error: "PROVIDER_ERROR", message } };
}

/**
 * Wrap a `ReadableStream<Uint8Array>` so that mid-stream errors surface as a final
 * SSE error event (`event: error\ndata: ...\n\n`) instead of abruptly terminating
 * the HTTP connection.
 *
 * The HTTP response is already 200 + Content-Type: text/event-stream by the time
 * the inner stream is being consumed, so we cannot change the status code. We emit
 * a well-formed SSE error event and close cleanly. Clients (Task 12
 * `consumeTranslationStream`) detect the `event: error` line and surface the
 * error to the UI; chunks already sent before the error are preserved.
 */
function wrapStreamWithErrorHandling(
  inner: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = inner.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Stream interrupted";
        const payload = JSON.stringify({
          error: "STREAM_INTERRUPTED",
          message,
        });
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${payload}\n\n`),
        );
        controller.close();
      }
    },
    cancel(reason) {
      // Propagate client-side cancellation to the inner stream.
      void reader.cancel(reason);
    },
  });
}

export const POST: RequestHandler = async ({ request }) => {
  // 1. Parse JSON body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(invalidRequest("Invalid JSON body").body, { status: 400 });
  }

  // 2. Validate against the translation request schema.
  const parsed = translationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(invalidRequest(parsed.error.message).body, { status: 400 });
  }
  const translationRequest = parsed.data;

  // 3. Build minimal settings from request and start the provider stream.
  //    Pre-stream errors (401 / 429 / unknown provider) are caught here and
  //    mapped to a JSON error response before any SSE data is sent.
  let innerStream: ReadableStream<Uint8Array>;
  try {
    innerStream = await streamTranslation(
      translationRequest,
      buildSettingsFromRequest(translationRequest),
    );
  } catch (err) {
    const mapped = mapProviderError(err);
    return json(mapped.body, { status: mapped.status });
  }

  // 4. Wrap with mid-stream error handling and return the SSE response.
  //    Same-origin only: no CORS `Access-Control-Allow-Origin` header is set.
  const stream = wrapStreamWithErrorHandling(innerStream);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
