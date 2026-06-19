import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { createSupabaseAdminClient } from "$lib/server/supabase-admin";
import type {
  Profile,
  UserStatus,
  UserRole,
  Database,
} from "$lib/supabase/database.types";

/**
 * `/api/admin/users` — user management.
 *
 * GET returns a paginated profiles list with per-user usage counts.
 * PATCH changes a user's `role` or `status`. Both use the service_role
 * client (admin reads/writes). Self-demotion and self-suspension are
 * blocked (400) to prevent the only admin from locking themselves out.
 *
 * Defense-in-depth: hooks already 404 non-admins; we re-check the role
 * here too.
 */

/** Profile shape surfaced to the admin UI (no secrets — profiles have none). */
type UserWithUsage = Profile & {
  usage_count: number;
  total_chars: number;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().max(120).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  role: z
    .enum(["user", "admin"] as const satisfies readonly UserRole[])
    .optional(),
  status: z
    .enum(["active", "suspended"] as const satisfies readonly UserStatus[])
    .optional(),
});

export const GET: RequestHandler = async (event) => {
  if (event.locals.profile?.role !== "admin") {
    throw error(404);
  }

  const parsed = listQuerySchema.safeParse({
    limit: event.url.searchParams.get("limit") ?? undefined,
    offset: event.url.searchParams.get("offset") ?? undefined,
    search: event.url.searchParams.get("search") ?? undefined,
  });
  if (!parsed.success) {
    return json(
      { error: "INVALID_REQUEST", message: parsed.error.message },
      { status: 400 },
    );
  }
  const limit = parsed.data.limit ?? DEFAULT_LIMIT;
  const offset = parsed.data.offset ?? 0;
  const search = parsed.data.search?.trim() || undefined;

  const admin = createSupabaseAdminClient();

  let profileQuery = admin
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    // Simple ilike on email/name. Whitespace already trimmed above.
    const like = `%${search}%`;
    profileQuery = profileQuery.or(`email.ilike.${like},name.ilike.${like}`);
  }

  const { data: profilesRaw, error: dbErr, count } = await profileQuery;
  if (dbErr) {
    return json(
      { error: "PROVIDER_ERROR", message: dbErr.message },
      { status: 500 },
    );
  }
  const profiles = (profilesRaw ?? []) as Profile[];

  // Aggregate usage per user. Volumes are small enough to fetch all usage
  // rows for the page's user ids and group client-side; avoids N+1 RPC calls.
  const userIds = profiles.map((p) => p.id);
  const perUser = new Map<string, { count: number; chars: number }>();
  if (userIds.length > 0) {
    const { data: usageRows, error: usageErr } = await admin
      .from("usage_logs")
      .select("user_id, input_chars, output_chars")
      .in("user_id", userIds);
    if (usageErr) {
      return json(
        { error: "PROVIDER_ERROR", message: usageErr.message },
        { status: 500 },
      );
    }
    for (const row of (usageRows ?? []) as Array<{
      user_id: string;
      input_chars: number | null;
      output_chars: number | null;
    }>) {
      const cur = perUser.get(row.user_id) ?? { count: 0, chars: 0 };
      cur.count += 1;
      cur.chars += (row.input_chars ?? 0) + (row.output_chars ?? 0);
      perUser.set(row.user_id, cur);
    }
  }

  const out: UserWithUsage[] = profiles.map((p) => {
    const agg = perUser.get(p.id) ?? { count: 0, chars: 0 };
    return { ...p, usage_count: agg.count, total_chars: agg.chars };
  });

  return json({ users: out, total: count ?? 0, limit, offset });
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
  if (req.role === undefined && req.status === undefined) {
    return json(
      { error: "INVALID_REQUEST", message: "Nothing to update" },
      { status: 400 },
    );
  }

  // Self-lockout prevention. The admin cannot demote OR suspend themselves —
  // a single-admin deployment would otherwise be bricked. The check is on
  // the acting admin's profile id, not the request body, so it's spoof-proof
  // at this layer.
  const meId = event.locals.profile.id;
  if (req.id === meId) {
    if (req.role === "user" || req.status === "suspended") {
      return json(
        {
          error: "INVALID_REQUEST",
          message: "You cannot demote or suspend your own account",
        },
        { status: 400 },
      );
    }
  }

  const update: Database["public"]["Tables"]["profiles"]["Update"] = {};
  if (req.role !== undefined) update.role = req.role;
  if (req.status !== undefined) update.status = req.status;

  const admin = createSupabaseAdminClient();
  const { data, error: dbErr } = await admin
    .from("profiles")
    .update(update)
    .eq("id", req.id)
    .select("*")
    .single();

  if (dbErr) {
    return json(
      { error: "PROVIDER_ERROR", message: dbErr.message },
      { status: 500 },
    );
  }

  return json({ user: data as Profile });
};
