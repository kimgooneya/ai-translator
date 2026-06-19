import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { Provider } from "$lib/schemas";
import type { ProviderPresetRow } from "$lib/supabase/database.types";

/**
 * GET /api/user/providers — the user-facing provider catalog.
 *
 * Returns the enabled `provider_presets` (id, display name, base URL, models,
 * default model, sort order) using the per-request `event.locals.supabase`
 * anon client. Phase A's RLS policy `"presets: auth read"` allows any
 * authenticated user to read this table; the hooks auth gate guarantees a
 * logged-in user.
 *
 * NEVER includes key material — `provider_keys` is never queried here (and is
 * RLS-blocked for anon/auth clients anyway). Response shape maps to the client
 * `Provider` type so the UI catalog store can consume it directly.
 */
export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) {
    return json(
      { error: "INVALID_REQUEST", message: "인증이 필요합니다" },
      { status: 401 },
    );
  }

  const { data, error } = await locals.supabase
    .from("provider_presets")
    .select("id, display_name, base_url, models, default_model, sort_order")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return json(
      {
        error: "PROVIDER_ERROR",
        message: "프로바이더 목록을 불러오지 못했습니다",
      },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as ProviderPresetRow[];
  const providers: Provider[] = rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    kind: "preset",
    baseURL: row.base_url,
    models: row.models,
    defaultModel: row.default_model,
  }));

  return json({ providers });
};
