/**
 * i18n setup for the translator app.
 *
 * Conventions:
 *   - Locale codes match `LANGUAGES` codes where possible (`ko`, `en`, `es`,
 *     `zh`, `ja`, `pt`) so the UI locale and translation targets feel unified.
 *   - Each locale is mapped to a BCP-47 tag for `Intl` APIs (date formatting).
 *   - Default UI locale is `ko` (the app's original language); fallback is `en`.
 *   - Locale persistence lives in `src/lib/stores/locale.ts` and is the single
 *     source of truth for the currently active UI language.
 */

import { init as svelteInit, addMessages, waitLocale, _ } from "svelte-i18n";
import { get } from "svelte/store";
import ko from "./locales/ko.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import pt from "./locales/pt.json";

/** UI locales supported by the app. */
export const SUPPORTED_LOCALES = ["ko", "en", "es", "zh", "ja", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Default UI locale — matches the app's original language. */
export const DEFAULT_LOCALE: Locale = "ko";

/** Fallback locale used when a key is missing in the active locale. */
export const FALLBACK_LOCALE: Locale = "en";

/**
 * BCP-47 tags for `Intl` APIs (date/time/number formatting).
 *
 * Spanish uses Latin American (`es-419`) and Portuguese uses Brazilian
 * (`pt-BR`) to match the primary target markets identified for this app.
 * Chinese is Simplified (`zh-CN`).
 */
export const BCP47: Readonly<Record<Locale, string>> = {
  ko: "ko-KR",
  en: "en-US",
  es: "es-419",
  zh: "zh-CN",
  ja: "ja-JP",
  pt: "pt-BR",
};

/** Human-readable label for each UI locale, shown in the language switcher. */
export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  ko: "한국어",
  en: "English",
  es: "Español",
  zh: "中文",
  ja: "日本語",
  pt: "Português",
};

/** Type guard: narrow an arbitrary string to a supported locale. */
export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/** All locale JSON blobs indexed by locale code. */
const LOCALE_MESSAGES: Record<Locale, typeof ko> = {
  ko,
  en,
  es,
  zh,
  ja,
  pt,
};

let initialized = false;

/**
 * Initialize svelte-i18n with all supported locales.
 *
 * Safe to call multiple times — subsequent calls only swap the initial locale
 * without re-registering messages. The caller is responsible for persisting
 * and restoring the active locale via `localeStore` (see `stores/locale.ts`).
 */
export function initI18n(initial: Locale = DEFAULT_LOCALE): void {
  if (!initialized) {
    for (const loc of SUPPORTED_LOCALES) {
      addMessages(loc, LOCALE_MESSAGES[loc]);
    }
    svelteInit({
      fallbackLocale: FALLBACK_LOCALE,
      initialLocale: initial,
    });
    initialized = true;
  }
}

/**
 * Translate a key outside of a Svelte component (e.g. in `.ts` modules).
 *
 * svelte-i18n's `_` is a `Readable<MessageFormatter>` store, so it can't be
 * called directly in `.ts` files. This helper reads the current formatter
 * synchronously and invokes it. Use `$_('key')` inside `.svelte` files
 * (auto-subscribed) and `t('key')` inside `.ts` files.
 */
export function t(key: string, params?: Record<string, unknown>): string {
  return get(_)(key, params);
}

/**
 * Format a date for display in the given locale using the app's standard
 * YYYY.MM.DD. HH:MM pattern. Accepts null/undefined for the locale argument
 * to gracefully handle the loose typing of svelte-i18n's `$locale` store.
 */
export function formatDate(
  date: Date,
  locale?: Locale | string | null,
): string {
  const resolved: Locale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return date.toLocaleString(BCP47[resolved], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { waitLocale };
