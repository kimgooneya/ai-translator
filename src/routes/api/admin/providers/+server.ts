import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { createSupabaseAdminClient } from "$lib/server/supabase-admin";
import type {
  ProviderPresetRow,
  Database,
} from "$lib/supabase/database.types";

/**
 * `/api/admin/providers` — preset CRUD.
 *
 * Defense-in-depth: `hooks.server.ts` already 404s non-admins on `/api/admin/*`,
 * but every handler here re-checks `event.locals.profile?.role === "admin"`
 * before doing anything. The service_role admin client is used so RLS never
 * blocks admin writes/reads of `provider_presets`.
 *
 * Key material (`provider_keys`) is referenced only to surface a count of
 * active keys per preset — `encrypted_key` is never selected here.
 */

/** Public preset shape returned to the admin UI (no secrets; presets have none). */
type PresetWithKeyCount = ProviderPresetRow & {
  active_key_count: number;
};

/** Zod schema for POST (create). `id` is required; models must be non-empty. */
const createSchema = z.object({
  id: z.string().min(1).max(64),
  display_name: z.string().min(1),
  base_url: z.string().min(1),
  models: z.array(z.string().min(1)).min(1),
  default_model: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

/** Zod schema for PUT (update). `id` is required; all other fields optional. */
const updateSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1).optional(),
  base_url: z.string().min(1).optional(),
  models: z.array(z.string().min(1)).min(1).optional(),
  default_model: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

/** Zod schema for DELETE. */
const deleteSchema = z.object({ id: z.string().min(1) });

/** Assert `default_model ∈ models` — both fields must be present together. */
function assertDefaultModelInModels(
  models: string[],
  defaultModel: string,
): string | null {
  return models.includes(defaultModel)
    ? null
    : "default_model must be in models";
}

export const GET: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  const admin = createSupabaseAdminClient();
  const { data, error: dbError } = await admin
    .from("provider_presets")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  const presets = (data ?? []) as ProviderPresetRow[];

  // Aggregate active keys per preset in a single query (volumes are tiny).
  const { data: keyCounts, error: keyErr } = await admin
    .from("provider_keys")
    .select("provider_id")
    .eq("enabled", true);

  if (keyErr) {
    return json(
      { error: "PROVIDER_ERROR", message: keyErr.message },
      { status: 500 },
    );
  }

  const countMap = new Map<string, number>();
  for (const row of keyCounts ?? []) {
    const pid = (row as { provider_id: string }).provider_id;
    countMap.set(pid, (countMap.get(pid) ?? 0) + 1);
  }

  const out: PresetWithKeyCount[] = presets.map((p) => ({
    ...p,
    active_key_count: countMap.get(p.id) ?? 0,
  }));

  return json({ presets: out });
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
  const modelError = assertDefaultModelInModels(req.models, req.default_model);
  if (modelError) {
    return json(
      { error: "INVALID_REQUEST", message: modelError },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error: dbError } = await admin
    .from("provider_presets")
    .insert({
      id: req.id,
      display_name: req.display_name,
      base_url: req.base_url,
      models: req.models,
      default_model: req.default_model,
      enabled: req.enabled,
      sort_order: req.sort_order,
      updated_by: event.locals.profile.id,
    })
    .select("*")
    .single();

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  return json({ preset: data }, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: parsed.error.message },
      { status: 400 },
    );
  }
  const req = parsed.data;

  // If both models and default_model are being changed, validate consistency.
  if (req.models && req.default_model) {
    const mErr = assertDefaultModelInModels(req.models, req.default_model);
    if (mErr) {
      return json({ error: "INVALID_REQUEST", message: mErr }, { status: 400 });
    }
  }

  // Explicit per-field assignment — the typed Update rejects dynamic keys,
  // so a loop would need an unsafe cast.
  const update: Database["public"]["Tables"]["provider_presets"]["Update"] = {
    updated_by: event.locals.profile.id,
    updated_at: new Date().toISOString(),
  };
  if (req.display_name !== undefined) update.display_name = req.display_name;
  if (req.base_url !== undefined) update.base_url = req.base_url;
  if (req.models !== undefined) update.models = req.models;
  if (req.default_model !== undefined) update.default_model = req.default_model;
  if (req.enabled !== undefined) update.enabled = req.enabled;
  if (req.sort_order !== undefined) update.sort_order = req.sort_order;

  const admin = createSupabaseAdminClient();
  const { data, error: dbError } = await admin
    .from("provider_presets")
    .update(update)
    .eq("id", req.id)
    .select("*")
    .single();

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  return json({ preset: data });
};

export const DELETE: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  let body: unknown;
  try {
    body = await event.request.json();
  } catch {
    // Allow query-string fallback (?id=) so the call works without a body too.
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
  const { id } = parsed.data;

  // Pre-count keys so we can return a clear "cascade deleted N keys" message.
  // The FK has ON DELETE CASCADE, so the delete itself removes them.
  const admin = createSupabaseAdminClient();
  const { count: keysCount, error: countErr } = await admin
    .from("provider_keys")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", id);

  if (countErr) {
    return json(
      { error: "PROVIDER_ERROR", message: countErr.message },
      { status: 500 },
    );
  }

  const { error: dbError } = await admin
    .from("provider_presets")
    .delete()
    .eq("id", id);

  if (dbError) {
    return json(
      { error: "PROVIDER_ERROR", message: dbError.message },
      { status: 500 },
    );
  }

  return json({
    id,
    deleted: true,
    cascaded_keys_deleted: keysCount ?? 0,
  });
};
