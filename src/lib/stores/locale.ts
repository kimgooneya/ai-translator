/**
 * Persisted UI locale store.
 *
 * Single source of truth for the active UI language. The svelte-i18n `$locale`
 * store is kept in sync via a subscription set up in `+layout.svelte`, so
 * callers only need to interact with `localeStore` (read/set/reset).
 */

import { z } from "zod";
import { persistedWritable } from "$lib/storage/stores";
import { STORAGE_KEYS } from "$lib/storage";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  type Locale,
} from "$lib/i18n";

const localeSchema = z.enum(SUPPORTED_LOCALES);

export const localeStore = persistedWritable<Locale>(
  STORAGE_KEYS.locale,
  localeSchema,
  DEFAULT_LOCALE,
  // Migrate legacy values: anything that isn't a supported locale resets to
  // the default rather than crashing svelte-i18n's loader.
  (value) => (isSupportedLocale(value) ? value : DEFAULT_LOCALE),
);
