import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { APIError } from "openai";
import {
  translationRequestSchema,
  type TranslationRequest,
  type ResolvedProvider,
} from "$lib/schemas";
import { streamTranslation } from "$lib/providers/translate";
import {
  getEnabledPreset,
  resolveActiveKey,
  NoActiveKeyError,
  KeyDecryptionError,
} from "$lib/server/provider-keys";
import { createSupabaseAdminClient } from "$lib/server/supabase-admin";
import type { Database } from "$lib/supabase/database.types";

type ErrorBody = { error: string; message: string };
type ErrorResponse = { status: number; body: ErrorBody };

function invalidRequest(message: string): ErrorResponse {
  return { status: 400, body: { error: "INVALID_REQUEST", message } };
}

/**
 * Map an error thrown by `streamTranslation` (or the OpenAI SDK) to an HTTP
 * error response. Pre-stream errors (e.g. 401 / 429 on the initial request)
 * land here; mid-stream errors are handled separately by
 * `wrapStreamWithErrorHandling`.
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
  // Decrypt failures surface as KeyDecryptionError — never reveal key/crypto
  // details, just a generic provider error.
  if (err instanceof KeyDecryptionError) {
    return {
      status: 500,
      body: {
        error: "PROVIDER_ERROR",
        message: "저장된 API 키를 복호화하지 못했습니다",
      },
    };
  }
  const message = err instanceof Error ? err.message : "Unknown provider error";
  return { status: 500, body: { error: "PROVIDER_ERROR", message } };
}

/**
 * Wrap a `ReadableStream<Uint8Array>` so that mid-stream errors surface as a
 * final SSE error event (`event: error\ndata: ...\n\n`) instead of abruptly
 * terminating the HTTP connection. Wire format preserved exactly.
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

type SseParsed =
  | { type: "chunk"; text: string }
  | { type: "error"; errorCode: string | null }
  | { type: "done" }
  | null;

/** Parse one raw SSE event (bytes between two `\n\n` boundaries). */
function parseSseEvent(rawEvent: string): SseParsed {
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
      const parsed = JSON.parse(data) as { error?: string };
      return { type: "error", errorCode: parsed.error ?? null };
    } catch {
      return { type: "error", errorCode: null };
    }
  }
  if (data === "[DONE]") return { type: "done" };
  if (data === "") return null;
  return { type: "chunk", text: data };
}

type UsageResult = {
  outputChars: number;
  status: "ok" | "error";
  errorCode: string | null;
};

/**
 * Pass-through wrapper that counts translated output chars and detects a
 * terminal error event, then fires {@link onComplete} exactly once when the
 * stream finishes naturally. Bytes forwarded to the client are IDENTICAL to
 * the input — this wrapper only observes a decoded copy for telemetry.
 *
 * User-initiated cancellation does NOT fire `onComplete` (no usage row) —
 * only natural completion (ok) or a server-side mid-stream error do.
 */
function wrapStreamWithUsage(
  source: ReadableStream<Uint8Array>,
  onComplete: (result: UsageResult) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const reader = source.getReader();
  let buffer = "";
  let outputChars = 0;
  let status: "ok" | "error" = "ok";
  let errorCode: string | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          onComplete({ outputChars, status, errorCode });
          return;
        }
        // Forward the exact bytes to the client.
        controller.enqueue(value);
        // Observe a decoded copy for usage counting.
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const parsed = parseSseEvent(rawEvent);
          if (!parsed) continue;
          if (parsed.type === "error") {
            status = "error";
            errorCode = parsed.errorCode;
          } else if (parsed.type === "chunk") {
            outputChars += parsed.text.length;
          }
        }
      } catch (err) {
        // The source is the error-wrapped stream, which never throws under
        // normal operation. If something truly unexpected happens, surface it
        // and record an error status.
        controller.error(err);
        onComplete({
          outputChars,
          status: "error",
          errorCode: "STREAM_INTERRUPTED",
        });
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}

type UsageLogInsert = Database["public"]["Tables"]["usage_logs"]["Insert"];

/**
 * Fire-and-forget `usage_logs` insert via the service_role client. MUST NOT
 * block or reject into the response path — any failure is logged and swallowed
 * (usage telemetry is best-effort, never user-facing).
 */
function insertUsageLog(entry: UsageLogInsert): void {
  void (async () => {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("usage_logs").insert(entry);
      if (error) {
        console.warn("[usage_logs] insert failed:", error.message);
      }
    } catch (err) {
      console.warn("[usage_logs] insert threw:", err);
    }
  })();
}

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Parse JSON body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(invalidRequest("Invalid JSON body").body, { status: 400 });
  }

  // 2. Validate against the (apiKey-less) translation request schema.
  const parsed = translationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(invalidRequest(parsed.error.message).body, { status: 400 });
  }
  const req: TranslationRequest = parsed.data;

  // 3. Auth — hooks.server.ts guarantees a logged-in user for non-public
  //    routes, so this is purely defensive. If the session/profile is somehow
  //    missing, refuse before touching the DB.
  const profile = locals.profile;
  if (!locals.user || !profile) {
    return json(
      { error: "INVALID_REQUEST", message: "인증이 필요합니다" },
      { status: 401 },
    );
  }

  // 4. Resolve the provider preset from the DB. Unknown/disabled providers
  //    are rejected as INVALID_REQUEST before any key lookup.
  const preset = await getEnabledPreset(req.providerId);
  if (!preset) {
    return json(
      invalidRequest(`Provider "${req.providerId}" not available`).body,
      { status: 400 },
    );
  }
  if (!preset.models.includes(req.model)) {
    return json(
      invalidRequest(
        `Model "${req.model}" is not available for provider "${preset.display_name}"`,
      ).body,
      { status: 400 },
    );
  }

  // 5. Resolve + decrypt the active managed key. No key → 401 (admin must add
  //    one). Decrypt failure → 500 PROVIDER_ERROR (never reveal key details).
  let apiKey: string;
  try {
    apiKey = await resolveActiveKey(req.providerId);
  } catch (err) {
    if (err instanceof NoActiveKeyError) {
      return json(
        {
          error: "INVALID_API_KEY",
          message: "이 provider에 등록된 API 키가 없습니다",
        },
        { status: 401 },
      );
    }
    const mapped = mapProviderError(err);
    return json(mapped.body, { status: mapped.status });
  }

  // 6. Build the resolved provider and start the stream. baseURL comes from
  //    the DB preset (NOT the client/PRESET_PROVIDERS). Pre-stream provider
  //    errors (401/429/500) are mapped to JSON before any SSE is sent.
  const resolved: ResolvedProvider = {
    id: preset.id,
    name: preset.display_name,
    baseURL: preset.base_url,
    models: preset.models,
    defaultModel: preset.default_model,
    apiKey,
  };

  let innerStream: ReadableStream<Uint8Array>;
  try {
    innerStream = await streamTranslation(req, resolved);
  } catch (err) {
    const mapped = mapProviderError(err);
    return json(mapped.body, { status: mapped.status });
  }

  // 7. Wrap with mid-stream error handling (SSE error event) and usage
  //    telemetry (counts output chars, fire-and-forget usage_logs insert).
  //    Same-origin only: no CORS `Access-Control-Allow-Origin` header is set.
  const startedAt = Date.now();
  const errorWrapped = wrapStreamWithErrorHandling(innerStream);
  const stream = wrapStreamWithUsage(
    errorWrapped,
    ({ outputChars, status, errorCode }) => {
      insertUsageLog({
        user_id: profile.id,
        provider_id: req.providerId,
        model: req.model,
        source_lang: req.sourceLang,
        target_lang: req.targetLang,
        input_chars: req.sourceText.length,
        output_chars: outputChars,
        duration_ms: Date.now() - startedAt,
        status,
        error_code: errorCode,
      });
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
