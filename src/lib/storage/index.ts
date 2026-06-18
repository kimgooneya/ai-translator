import type { z } from "zod";

export const STORAGE_KEYS = {
  settings: "translator.settings",
  glossary: "translator.glossary",
  history: "translator.history",
  dismissedNotices: "translator.dismissedNotices",
  theme: "translator.theme",
  locale: "translator.locale",
} as const;

export interface SaveResult {
  ok: boolean;
  error?: "quota" | "serialize" | "invalid" | "unavailable";
  message?: string;
}

function isBrowser(): boolean {
  return typeof localStorage !== "undefined";
}

export function loadFromStorage<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return schema.parse(parsed);
  } catch (err) {
    console.warn(`[storage] load failed for key "${key}":`, err);
    return fallback;
  }
}

export function saveToStorage<T>(
  key: string,
  value: T,
  schema: z.ZodType<T>,
): SaveResult {
  if (!isBrowser()) {
    return {
      ok: false,
      error: "unavailable",
      message: "localStorage not available",
    };
  }
  try {
    schema.parse(value);
  } catch (err) {
    return {
      ok: false,
      error: "invalid",
      message: `Schema validation failed: ${(err as Error).message}`,
    };
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (err) {
    const name = (err as Error)?.name;
    if (name === "QuotaExceededError") {
      return {
        ok: false,
        error: "quota",
        message: "localStorage quota exceeded",
      };
    }
    return {
      ok: false,
      error: "serialize",
      message: (err as Error).message,
    };
  }
}

export function removeFromStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] remove failed for key "${key}":`, err);
  }
}
