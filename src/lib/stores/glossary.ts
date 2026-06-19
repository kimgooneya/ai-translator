import { writable } from "svelte/store";
import { get } from "svelte/store";
import { toast } from "svelte-sonner";
import { supabaseBrowser } from "$lib/supabase/client";
import { userStore } from "$lib/stores/auth";
import { t } from "$lib/i18n";
import type { Glossary, GlossaryEntry } from "$lib/schemas";
import type { GlossaryEntryRow } from "$lib/supabase/database.types";

const fallback: Glossary = { enabled: false, entries: [] };

/**
 * In-memory glossary store. Backed by Supabase `glossaries` (1 per user) +
 * `glossary_entries`. Refetches whenever the signed-in user changes.
 */
export const glossaryStore = writable<Glossary>(fallback);

/** Current authenticated user id (null when logged out). */
let currentUserId: string | null = null;
/** Cached id of the current user's row in `glossaries`. */
let cachedGlossaryId: string | null = null;

/** Map a DB entry row to the camelCase GlossaryEntry shape. */
function rowToEntry(row: GlossaryEntryRow): GlossaryEntry {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    ...(row.note !== null ? { note: row.note } : {}),
  };
}

/**
 * Resolve the user's glossary row id, creating one on-demand if the signup
 * trigger didn't fire. Cached after first resolution for the lifetime of the
 * signed-in session.
 */
async function ensureGlossaryId(userId: string): Promise<string | null> {
  if (cachedGlossaryId) return cachedGlossaryId;

  const { data, error } = await supabaseBrowser
    .from("glossaries")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[glossaryStore] fetch glossary id failed:", error.message);
    return null;
  }

  if (data?.id) {
    cachedGlossaryId = data.id;
    return cachedGlossaryId;
  }

  const { data: created, error: createError } = await supabaseBrowser
    .from("glossaries")
    .insert({ user_id: userId, enabled: false })
    .select()
    .single();

  if (createError || !created) {
    console.error(
      "[glossaryStore] create-on-demand failed:",
      createError?.message,
    );
    return null;
  }

  cachedGlossaryId = created.id;
  return cachedGlossaryId;
}

/**
 * Fetch the user's glossary (enabled flag + all entries) and populate the
 * store. Called on init and whenever the signed-in user changes.
 */
async function loadGlossary(userId: string): Promise<void> {
  const { data: glossaryRow, error: gErr } = await supabaseBrowser
    .from("glossaries")
    .select("id, enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (gErr) {
    console.error("[glossaryStore] load glossary failed:", gErr.message);
    toast.error(t("errors.UNKNOWN"));
    glossaryStore.set(fallback);
    cachedGlossaryId = null;
    return;
  }

  // No glossary row yet (trigger hasn't fired). Try to create one; if that
  // also fails, fall back to empty.
  let row = glossaryRow;
  if (!row) {
    const gid = await ensureGlossaryId(userId);
    if (!gid) {
      glossaryStore.set(fallback);
      return;
    }
    const { data: fresh } = await supabaseBrowser
      .from("glossaries")
      .select("id, enabled")
      .eq("user_id", userId)
      .maybeSingle();
    row = fresh;
  }

  if (!row) {
    glossaryStore.set(fallback);
    return;
  }

  cachedGlossaryId = row.id;

  const { data: entryRows, error: eErr } = await supabaseBrowser
    .from("glossary_entries")
    .select("*")
    .eq("glossary_id", row.id)
    .order("created_at", { ascending: true });

  if (eErr) {
    console.error("[glossaryStore] load entries failed:", eErr.message);
    toast.error(t("errors.UNKNOWN"));
    glossaryStore.set({ enabled: row.enabled, entries: [] });
    return;
  }

  glossaryStore.set({
    enabled: row.enabled,
    entries: (entryRows ?? []).map(rowToEntry),
  });
}

/** Append a new entry to the glossary. */
export async function addEntry(entry: GlossaryEntry): Promise<void> {
  if (!currentUserId) {
    console.warn("[glossaryStore] addEntry called with no signed-in user");
    return;
  }
  const gid = await ensureGlossaryId(currentUserId);
  if (!gid) {
    toast.error(t("errors.UNKNOWN"));
    return;
  }

  // Optimistic append so the UI updates immediately.
  glossaryStore.update((g) => ({ ...g, entries: [...g.entries, entry] }));

  const { data, error } = await supabaseBrowser
    .from("glossary_entries")
    .insert({
      glossary_id: gid,
      source: entry.source,
      target: entry.target,
      note: entry.note ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[glossaryStore] insert failed:", error?.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back the optimistic entry.
    glossaryStore.update((g) => ({
      ...g,
      entries: g.entries.filter((e) => e.id !== entry.id),
    }));
    return;
  }

  // Reconcile: replace the optimistic entry (temp id) with the persisted row.
  const persisted = rowToEntry(data as GlossaryEntryRow);
  glossaryStore.update((g) => ({
    ...g,
    entries: g.entries.map((e) => (e.id === entry.id ? persisted : e)),
  }));
}

/** Patch an existing entry by id (no-op if the id is not found). */
export async function updateEntry(
  id: string,
  patch: Partial<GlossaryEntry>,
): Promise<void> {
  const previous = get(glossaryStore);
  const target = previous.entries.find((e) => e.id === id);
  if (!target) return;

  // Optimistic patch.
  glossaryStore.update((g) => ({
    ...g,
    entries: g.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));

  // Build a snake_case patch for the DB, dropping undefined fields. Type the
  // object literal inline so supabase-js's RejectExcessProperties check sees
  // the narrow Update shape, not a loose Record<string, ...>.
  const dbPatch: {
    source?: string;
    target?: string;
    note?: string | null;
  } = {};
  if (patch.source !== undefined) dbPatch.source = patch.source;
  if (patch.target !== undefined) dbPatch.target = patch.target;
  if (patch.note !== undefined) dbPatch.note = patch.note;

  const { error } = await supabaseBrowser
    .from("glossary_entries")
    .update(dbPatch)
    .eq("id", id);

  if (error) {
    console.error("[glossaryStore] update failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back.
    glossaryStore.set(previous);
  }
}

/** Remove the entry with the given id. */
export async function removeEntry(id: string): Promise<void> {
  const previous = get(glossaryStore);
  if (!previous.entries.some((e) => e.id === id)) return;

  // Optimistic remove.
  glossaryStore.update((g) => ({
    ...g,
    entries: g.entries.filter((e) => e.id !== id),
  }));

  const { error } = await supabaseBrowser
    .from("glossary_entries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[glossaryStore] delete failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back.
    glossaryStore.set(previous);
  }
}

/** Flip the global glossary.enabled flag. */
export async function toggleEnabled(): Promise<void> {
  if (!currentUserId) {
    console.warn("[glossaryStore] toggleEnabled called with no signed-in user");
    return;
  }
  const previous = get(glossaryStore).enabled;
  const next = !previous;

  // Optimistic flip.
  glossaryStore.update((g) => ({ ...g, enabled: next }));

  const { error } = await supabaseBrowser
    .from("glossaries")
    .update({ enabled: next })
    .eq("user_id", currentUserId);

  if (error) {
    console.error("[glossaryStore] toggle failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back.
    glossaryStore.update((g) => ({ ...g, enabled: previous }));
  }
}

/** Generate a unique, opaque entry id (legacy compat; DB overrides on insert). */
export function generateEntryId(): string {
  return `glossary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Initialization: refetch whenever the signed-in user changes. ┴────────

if (typeof window !== "undefined") {
  userStore.subscribe((user) => {
    const nextId = user?.id ?? null;
    if (nextId === currentUserId) return;
    currentUserId = nextId;
    cachedGlossaryId = null;
    if (nextId) {
      void loadGlossary(nextId);
    } else {
      glossaryStore.set(fallback);
    }
  });
}
