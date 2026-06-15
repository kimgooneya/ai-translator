import { z } from "zod";
import { persistedWritable } from "$lib/storage/stores";
import { translationHistoryEntrySchema } from "$lib/schemas";
import type { TranslationHistoryEntry } from "$lib/schemas";
import { STORAGE_KEYS } from "$lib/storage";

/** Maximum number of entries retained. Oldest entries are dropped when exceeded. */
export const HISTORY_LIMIT = 100;

const historyArraySchema = z.array(translationHistoryEntrySchema);

export const historyStore = persistedWritable<TranslationHistoryEntry[]>(
  STORAGE_KEYS.history,
  historyArraySchema,
  [],
);

/**
 * Prepend a new entry (newest first). When the list would exceed HISTORY_LIMIT,
 * the oldest entries (those at the tail) are trimmed.
 */
export function addHistoryEntry(entry: TranslationHistoryEntry): void {
  historyStore.update((items) => {
    const next = [entry, ...items];
    return next.length > HISTORY_LIMIT ? next.slice(0, HISTORY_LIMIT) : next;
  });
}

/** Remove the entry with the given id (no-op if not found). */
export function removeHistoryEntry(id: string): void {
  historyStore.update((items) => items.filter((e) => e.id !== id));
}

/** Remove all entries. */
export function clearHistory(): void {
  historyStore.set([]);
}
