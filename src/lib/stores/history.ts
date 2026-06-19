import { writable } from "svelte/store";
import { get } from "svelte/store";
import { toast } from "svelte-sonner";
import { supabaseBrowser } from "$lib/supabase/client";
import { userStore } from "$lib/stores/auth";
import { t } from "$lib/i18n";
import type { TranslationHistoryEntry } from "$lib/schemas";
import type { TranslationHistoryRow } from "$lib/supabase/database.types";

/** Maximum number of entries retained. Oldest entries are dropped when exceeded. */
export const HISTORY_LIMIT = 100;

/**
 * In-memory history store. Backed by Supabase `translation_history` (per-user,
 * RLS-scoped). Refetches whenever the signed-in user changes.
 */
export const historyStore = writable<TranslationHistoryEntry[]>([]);

/** Current authenticated user id (null when logged out). */
let currentUserId: string | null = null;

/** Map a DB row (snake_case) to a TranslationHistoryEntry (camelCase). */
function rowToEntry(row: TranslationHistoryRow): TranslationHistoryEntry {
  return {
    id: row.id,
    // The request column is jsonb; cast through unknown since the row type
    // uses Record<string, unknown> but the schema type is narrower.
    request: row.request as TranslationHistoryEntry["request"],
    response: row.response,
    providerName: row.provider_name,
    modelName: row.model_name,
    createdAt: row.created_at,
    ...(row.tokens_used !== null ? { tokensUsed: row.tokens_used } : {}),
  };
}

/**
 * Fetch the newest HISTORY_LIMIT rows for the given user and populate the
 * store. Called on init and whenever the signed-in user changes.
 */
async function loadHistory(userId: string): Promise<void> {
  const { data, error } = await supabaseBrowser
    .from("translation_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error("[historyStore] load failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    historyStore.set([]);
    return;
  }

  const entries = (data ?? []).map(rowToEntry);
  historyStore.set(entries);
}

/**
 * Delete rows beyond HISTORY_LIMIT for the given user (keep newest 100).
 * Best-effort: failures are logged but do not surface to the user since the
 * capped select in loadHistory already hides overflow from the UI.
 */
async function pruneHistory(userId: string): Promise<void> {
  const { data: overflow, error } = await supabaseBrowser
    .from("translation_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(HISTORY_LIMIT, HISTORY_LIMIT * 2);

  if (error) {
    console.warn("[historyStore] prune fetch failed:", error.message);
    return;
  }
  if (!overflow || overflow.length === 0) return;

  const { error: delError } = await supabaseBrowser
    .from("translation_history")
    .delete()
    .in(
      "id",
      overflow.map((r) => r.id),
    );

  if (delError) {
    console.warn("[historyStore] prune delete failed:", delError.message);
  }
}

/**
 * Prepend a new entry (newest first). Persists to Supabase; the store is
 * updated optimistically and reconciled with the DB-generated row (uuid,
 * server timestamp).
 *
 * Returns a Promise — existing call sites treat it as fire-and-forget.
 */
export async function addHistoryEntry(
  entry: TranslationHistoryEntry,
): Promise<void> {
  if (!currentUserId) {
    console.warn(
      "[historyStore] addHistoryEntry called with no signed-in user",
    );
    return;
  }

  // Optimistic prepend so the UI updates immediately.
  historyStore.update((items) => [entry, ...items].slice(0, HISTORY_LIMIT));

  const { data, error } = await supabaseBrowser
    .from("translation_history")
    .insert({
      user_id: currentUserId,
      request: entry.request as unknown as Record<string, unknown>,
      response: entry.response,
      provider_name: entry.providerName,
      model_name: entry.modelName,
      created_at: entry.createdAt,
      tokens_used: entry.tokensUsed ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[historyStore] insert failed:", error?.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back the optimistic entry.
    historyStore.update((items) => items.filter((e) => e.id !== entry.id));
    return;
  }

  // Reconcile: replace the optimistic entry (temp id) with the persisted row.
  const persisted = rowToEntry(data as TranslationHistoryRow);
  historyStore.update((items) =>
    items.map((e) => (e.id === entry.id ? persisted : e)),
  );

  // Fire-and-forget cap enforcement.
  void pruneHistory(currentUserId);
}

/** Remove the entry with the given id (no-op if not found). */
export async function removeHistoryEntry(id: string): Promise<void> {
  if (!currentUserId) {
    console.warn(
      "[historyStore] removeHistoryEntry called with no signed-in user",
    );
    return;
  }

  const previous = get(historyStore);
  // Optimistic remove.
  historyStore.update((items) => items.filter((e) => e.id !== id));

  const { error } = await supabaseBrowser
    .from("translation_history")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[historyStore] delete failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back.
    historyStore.set(previous);
  }
}

/** Remove all entries for the current user. */
export async function clearHistory(): Promise<void> {
  if (!currentUserId) {
    console.warn("[historyStore] clearHistory called with no signed-in user");
    return;
  }

  const previous = get(historyStore);
  // Optimistic clear.
  historyStore.set([]);

  const { error } = await supabaseBrowser
    .from("translation_history")
    .delete()
    .eq("user_id", currentUserId);

  if (error) {
    console.error("[historyStore] clear failed:", error.message);
    toast.error(t("errors.UNKNOWN"));
    // Roll back.
    historyStore.set(previous);
  }
}

// ─── Initialization: refetch whenever the signed-in user changes. ┴────────

if (typeof window !== "undefined") {
  userStore.subscribe((user) => {
    const nextId = user?.id ?? null;
    if (nextId === currentUserId) return;
    currentUserId = nextId;
    if (nextId) {
      void loadHistory(nextId);
    } else {
      historyStore.set([]);
    }
  });
}
