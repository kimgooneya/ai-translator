import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { createSupabaseAdminClient } from "$lib/server/supabase-admin";
import { encryptKey } from "$lib/server/crypto";
import type {
  ProviderKeyRow,
  Database,
} from "$lib/supabase/database.types";

/**
 * `/api/admin/provider-keys` — managed-key CRUD.
 *
 * CRITICAL: `encrypted_key` and plaintext keys are NEVER returned by any
 * handler here. GET strips the column from every row before responding;
 * POST encrypts plaintext with `encryptKey` and returns only the masked
 * `key_hint`. See {@link maskKey} for the masking rule.
 *
 * Defense-in-depth: hooks already 404 non-admins; we re-check the role
 * before any DB work and use the service_role client for all access
 * (`provider_keys` has RLS enabled with no policies — service_role only).
 */

/** Masked-only shape returned to the UI. The full row is never serialized. */
type KeyView = {
  id: string;
  provider_id: string;
  key_hint: string;
  label: string | null;
  enabled: boolean;
  created_at: string;
};

/** Project a DB row to the safe view (drops `encrypted_key`). */
function toKeyView(row: ProviderKeyRow): KeyView {
  return {
    id: row.id,
    provider_id: row.provider_id,
    key_hint: row.key_hint,
    label: row.label,
    enabled: row.enabled,
    created_at: row.created_at,
  };
}

/**
 * Build the masked display hint for a plaintext key.
 *
 * Rule: keep the first 3 chars + last 4 chars, separated by `...`. Short
 * keys (≤7 chars) are masked to their last 4 chars prefixed by `...` so
 * nothing identifying leaks. The exact rule is also computed server-side
 * on POST so the stored `key_hint` is authoritative; clients never see
 * plaintext after submission.
 *
 * Examples:
 *   "sk-abc123456789wxyz" → "sk-...wxyz"
 *   "key"                 → "...key"   (last 4 ≥ length → whole key)
 *   "abc"                 → "...abc"
 */
export function maskKey(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) return "";
  if (plaintext.length <= 7) {
    return "..." + plaintext.slice(-4);
  }
  return plaintext.slice(0, 3) + "..." + plaintext.slice(-4);
}

/** Query schema for GET (?provider_id=...). */
const listQuerySchema = z.object({
  provider_id: z.string().min(1),
});

/** POST body — plaintext is sent on submit only, never persisted client-side. */
const createSchema = z.object({
  provider_id: z.string().min(1),
  plaintext_key: z.string().min(1),
  label: z.string().max(64).optional().nullable(),
});

/** PATCH body — toggle enabled / change label. */
const patchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  label: z.string().max(64).optional().nullable(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export const GET: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  const parsed = listQuerySchema.safeParse({
    provider_id: event.url.searchParams.get("provider_id") ?? "",
  });
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: "provider_id is required" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  // Explicitly select only safe columns — `encrypted_key` is never selected.
  const { data, error: dbError } = await admin
    .from("provider_keys")
    .select("id, provider_id, key_hint, label, enabled, created_at")
    .eq("provider_id", parsed.data.provider_id)
    .order("created_at", { ascending: false });

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as KeyView[];
  return json({ keys: rows });
};

export const POST: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { error: "INVALID_REQUEST", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: parsed.error.message },
      { status: 400 },
    );
  }
  const req = parsed.data;

  // Encrypt + mask. The plaintext is consumed here and never assigned to a
  // variable that escapes this handler. `encryptKey` throws on empty input
  // (validated above) but we guard anyway to avoid leaking crypto internals.
  let encrypted_key: string;
  let key_hint: string;
  try {
    encrypted_key = encryptKey(req.plaintext_key);
    key_hint = maskKey(req.plaintext_key);
  } catch (err) {
    const message = err instanceof Error ? err.message : "encryption failed";
    return json({ error: "PROVIDER_ERROR", message }, { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error: dbError } = await admin
    .from("provider_keys")
    .insert({
      provider_id: req.provider_id,
      encrypted_key,
      key_hint,
      label: req.label ?? null,
      enabled: true,
      created_by: event.locals.profile.id,
    })
    .select("id, provider_id, key_hint, label, enabled, created_at")
    .single();

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  // Return the masked view only. `data` here is already column-restricted
  // by the `.select(...)` above, but project through `toKeyView` for clarity
  // so the response shape is identical to GET.
  return json({ key: toKeyView(data as ProviderKeyRow) }, { status: 201 });
};

export const PATCH: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    return json(
      { error: "INVALID_REQUEST", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: parsed.error.message },
      { status: 400 },
    );
  }
  const req = parsed.data;

  const update: Database["public"]["Tables"]["provider_keys"]["Update"] = {};
  let hasUpdate = false;
  if (req.enabled !== undefined) {
    update.enabled = req.enabled;
    hasUpdate = true;
  }
  if (req.label !== undefined) {
    update.label = req.label;
    hasUpdate = true;
  }
  if (!hasUpdate) {
    return json(
      { error: "INVALID_REQUEST", message: "Nothing to update" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error: dbError } = await admin
    .from("provider_keys")
    .update(update)
    .eq("id", req.id)
    .select("id, provider_id, key_hint, label, enabled, created_at")
    .single();

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  return json({ key: toKeyView(data as ProviderKeyRow) });
};

export const DELETE: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    const id = event.url.searchParams.get("id");
    if (!id) {
      return json(
        { error: "INVALID_REQUEST", message: "id is required" },
        { status: 400 },
      );
    }
    body = { id };
  }

  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: parsed.error.message },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { error: dbError } = await admin
    .from("provider_keys")
    .delete()
    .eq("id", parsed.data.id);

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  return json({ id: parsed.data.id, deleted: true });
};
