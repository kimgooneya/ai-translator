import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createSupabaseAdminClient } from "$lib/server/supabase-admin";
import type { UsageLogRow } from "$lib/supabase/database.types";

/**
 * `/api/admin/stats` — admin dashboard aggregations.
 *
 * Volumes here are small (single-instance deployment), so we run a few
 * aggregate queries via the service_role client and group client-side
 * where convenient. No Postgres function required.
 *
 * Defense-in-depth: hooks already 404 non-admins; we re-check the role
 * here too. No `provider_keys` material is queried by this endpoint.
 */

type DailySeriesPoint = {
  date: string; // YYYY-MM-DD
  count: number;
  chars: number;
};

type ProviderBreakdownPoint = {
  provider_id: string;
  count: number;
  chars: number;
};

type StatsResponse = {
  totals: {
    total_users: number;
    total_translations: number;
    total_chars: number;
    active_presets_with_keys: number;
  };
  providers: ProviderBreakdownPoint[];
  daily: DailySeriesPoint[];
  recent: UsageLogRow[];
};

/** Format a Date as a local YYYY-MM-DD string (UTC-stable across timezones). */
function toYyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build the trailing 7-day window (oldest first, inclusive of today). */
function lastSevenDays(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(toYyyyMmDd(d));
  }
  return out;
}

export const GET: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  const admin = createSupabaseAdminClient();

  // 1. profiles count
  const { count: totalUsers, error: usersErr } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (usersErr) {
    return json(
      { error: "PROVIDER_ERROR", message: usersErr.message },
      { status: 500 },
    );
  }

  // 2. usage totals (count + chars). Pre-selecting chars lets us sum
  //    client-side after a single round-trip; volumes are tiny.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);
  const sinceIso = sevenDaysAgo.toISOString();

  const { data: recentUsage, error: usageErr } = await admin
    .from("usage_logs")
    .select(
      "id, provider_id, input_chars, output_chars, created_at, status, model, user_id, source_lang, target_lang, duration_ms, error_code",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500);

  if (usageErr) {
    return json(
      { error: "PROVIDER_ERROR", message: usageErr.message },
      { status: 500 },
    );
  }
  const recentRows = (recentUsage ?? []) as UsageLogRow[];

  // All-time totals require a separate (un-windowed) query. Use head+count
  // for the count; for chars we read all rows. The dataset is small.
  const { count: totalTranslations, error: countErr } = await admin
    .from("usage_logs")
    .select("id", { count: "exact", head: true });
  if (countErr) {
    return json(
      { error: "PROVIDER_ERROR", message: countErr.message },
      { status: 500 },
    );
  }

  const { data: allUsage, error: allErr } = await admin
    .from("usage_logs")
    .select("provider_id, input_chars, output_chars");
  if (allErr) {
    return json(
      { error: "PROVIDER_ERROR", message: allErr.message },
      { status: 500 },
    );
  }
  const allRows = (allUsage ?? []) as Array<{
    provider_id: string;
    input_chars: number | null;
    output_chars: number | null;
  }>;

  let totalChars = 0;
  const providerMap = new Map<string, ProviderBreakdownPoint>();
  for (const row of allRows) {
    const chars = (row.input_chars ?? 0) + (row.output_chars ?? 0);
    totalChars += chars;
    const cur = providerMap.get(row.provider_id) ?? {
      provider_id: row.provider_id,
      count: 0,
      chars: 0,
    };
    cur.count += 1;
    cur.chars += chars;
    providerMap.set(row.provider_id, cur);
  }

  // 3. active presets with at least one enabled key. Count distinct providers.
  const { data: presetsWithKeys, error: presetsErr } = await admin
    .from("provider_keys")
    .select("provider_id")
    .eq("enabled", true);
  if (presetsErr) {
    return json(
      { error: "PROVIDER_ERROR", message: presetsErr.message },
      { status: 500 },
    );
  }
  const presetsWithKeysSet = new Set(
    (presetsWithKeys ?? []).map((r: { provider_id: string }) => r.provider_id),
  );

  // Sanity check: presets that don't exist in provider_presets shouldn't be
  // counted. Filter against a fresh preset list (FK should prevent this, but
  // defense-in-depth is cheap).
  const { data: presetRows, error: presetListErr } = await admin
    .from("provider_presets")
    .select("id");
  if (presetListErr) {
    return json(
      { error: "PROVIDER_ERROR", message: presetListErr.message },
      { status: 500 },
    );
  }
  const presetIds = new Set(
    (presetRows ?? []).map((r: { id: string }) => r.id),
  );
  const activePresetsWithKeys = [...presetsWithKeysSet].filter((id) =>
    presetIds.has(id),
  ).length;

  // 4. Build the 7-day daily series. Initialize all 7 buckets so missing
  //    days show zero (charts need contiguous points).
  const days = lastSevenDays();
  const dailyMap = new Map<string, DailySeriesPoint>(
    days.map((d) => [d, { date: d, count: 0, chars: 0 }]),
  );
  for (const row of recentRows) {
    const day = toYyyyMmDd(new Date(row.created_at));
    const bucket = dailyMap.get(day);
    if (!bucket) continue; // outside the 7-day window
    bucket.count += 1;
    bucket.chars += (row.input_chars ?? 0) + (row.output_chars ?? 0);
  }

  const out: StatsResponse = {
    totals: {
      total_users: totalUsers ?? 0,
      total_translations: totalTranslations ?? 0,
      total_chars: totalChars,
      active_presets_with_keys: activePresetsWithKeys,
    },
    providers: [...providerMap.values()].sort((a, b) => b.count - a.count),
    daily: days.map((d) => dailyMap.get(d)!),
    recent: recentRows.slice(0, 20),
  };

  return json(out);
};
