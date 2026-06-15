import { persistedWritable } from "$lib/storage/stores";
import { glossarySchema } from "$lib/schemas";
import type { Glossary, GlossaryEntry } from "$lib/schemas";
import { STORAGE_KEYS } from "$lib/storage";

const fallback: Glossary = { enabled: false, entries: [] };

export const glossaryStore = persistedWritable(
  STORAGE_KEYS.glossary,
  glossarySchema,
  fallback,
);

/** Append a new entry to the glossary. */
export function addEntry(entry: GlossaryEntry): void {
  glossaryStore.update((g) => ({ ...g, entries: [...g.entries, entry] }));
}

/** Patch an existing entry by id (no-op if the id is not found). */
export function updateEntry(id: string, patch: Partial<GlossaryEntry>): void {
  glossaryStore.update((g) => ({
    ...g,
    entries: g.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

/** Remove the entry with the given id. */
export function removeEntry(id: string): void {
  glossaryStore.update((g) => ({
    ...g,
    entries: g.entries.filter((e) => e.id !== id),
  }));
}

/** Flip the global glossary.enabled flag. */
export function toggleEnabled(): void {
  glossaryStore.update((g) => ({ ...g, enabled: !g.enabled }));
}

/** Generate a unique, opaque entry id. */
export function generateEntryId(): string {
  return `glossary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
