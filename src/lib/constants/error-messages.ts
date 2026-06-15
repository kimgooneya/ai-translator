/**
 * Error code → Korean user-facing message mapping.
 *
 * The streaming/server layer emits machine-readable error codes
 * (`INVALID_API_KEY`, `RATE_LIMITED`, …). This module is the single source of
 * truth that turns those codes into friendly Korean strings shown in toasts.
 *
 * Design notes:
 *   - Codes are mapped to the canonical Korean strings already defined in
 *     `UI.ERRORS` (Task 3) so every user-facing surface stays consistent.
 *   - Unknown codes (typos, new server codes not yet wired up) fall back to
 *     `UI.ERRORS.UNKNOWN` rather than surfacing a raw technical string — per
 *     the Task 13 MUST-NOT-DO: never expose stack traces / technical codes.
 *   - `getErrorMessage` is deliberately total (never throws) so callers can
 *     use it directly inside `addToast(...)` without extra guards.
 */

import { UI } from "./ui-strings";

/**
 * Keys of {@link UI.ERRORS} that are valid machine error codes.
 *
 * `UNKNOWN` is intentionally included so a round-trip through `getErrorMessage`
 * is idempotent, and excluded codes resolve to it.
 */
export type ErrorCode = keyof typeof UI.ERRORS;

/**
 * The canonical "unknown" fallback code. Exported so tests and callers can
 * reference it without hardcoding the literal.
 */
export const UNKNOWN_ERROR_CODE: ErrorCode = "UNKNOWN";

/**
 * All error codes recognized by the translator app. Centralized here so the
 * server (`/api/translate`), the streaming layer, and the toast wiring share a
 * single authoritative list.
 */
export const ERROR_CODES: readonly ErrorCode[] = Object.keys(
  UI.ERRORS,
) as readonly ErrorCode[];

/**
 * Map a machine error code to a localized Korean message safe to show users.
 *
 * @param code - Error code emitted by the server/streaming layer. Unknown or
 *   falsy values resolve to `UI.ERRORS.UNKNOWN`.
 * @returns A friendly Korean message (never empty, never technical).
 *
 * @example
 *   getErrorMessage('INVALID_API_KEY') // 'API 키를 확인하세요. 설정에서 다시 입력해 주세요.'
 *   getErrorMessage('RATE_LIMITED')    // '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
 *   getErrorMessage('STORAGE_FULL')    // '저장 공간이 가득 찼습니다. 오래된 기록을 삭제해 주세요.'
 */
export function getErrorMessage(code: string | null | undefined): string {
  if (code && code in UI.ERRORS) {
    return UI.ERRORS[code as ErrorCode];
  }
  return UI.ERRORS[UNKNOWN_ERROR_CODE];
}
