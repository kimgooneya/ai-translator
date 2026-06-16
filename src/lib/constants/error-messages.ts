/**
 * Error code → localized user-facing message helper.
 *
 * Codes are machine-readable strings emitted by the streaming/server layer
 * (`INVALID_API_KEY`, `RATE_LIMITED`, …). This module is the single source
 * of truth for the canonical code list and the bridge from a code to a
 * localized, user-safe message string (looked up via svelte-i18n under the
 * `errors.{CODE}` key — see `src/lib/i18n/locales/*.json`).
 *
 * Design notes:
 *   - Codes are centralized here so the server (`/api/translate`), the
 *     streaming layer, and the toast wiring share one authoritative list.
 *   - Unknown/missing codes fall back to `UNKNOWN` so users never see a raw
 *     technical code or an empty string.
 *   - `getErrorMessage` is total (never throws) and uses svelte-i18n's `_`
 *     helper so the returned string reflects the active UI locale.
 */

import { t } from "$lib/i18n";

/** Machine-readable error codes emitted by the server/streaming layer. */
export const ERROR_CODES = [
  "NO_API_KEY",
  "NO_ACTIVE_PROVIDER",
  "EMPTY_SOURCE",
  "INVALID_REQUEST",
  "INVALID_API_KEY",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "STREAM_INTERRUPTED",
  "NETWORK_ERROR",
  "STORAGE_FULL",
  "INVALID_FILE_TYPE",
  "PDF_NO_TEXT",
  "PDF_EXTRACTION_FAILED",
  "UNKNOWN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Canonical fallback code for unrecognized input. */
export const UNKNOWN_ERROR_CODE: ErrorCode = "UNKNOWN";

/** Type guard: narrows an arbitrary value to a known {@link ErrorCode}. */
export function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === "string" &&
    (ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Map a machine error code to a localized message safe to show users.
 *
 * @param code - Error code emitted by the server/streaming layer. Unknown,
 *   null, or undefined values resolve to the `UNKNOWN` code's message.
 * @returns A friendly message in the active UI locale (never empty, never
 *   a raw technical code).
 */
export function getErrorMessage(code: string | null | undefined): string {
  const normalized = isErrorCode(code) ? code : UNKNOWN_ERROR_CODE;
  return t(`errors.${normalized}`);
}
