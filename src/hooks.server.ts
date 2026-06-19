import type { Handle } from "@sveltejs/kit";
import { error, redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";
import type { Profile } from "$lib/supabase/database.types";

/**
 * Per-request auth gate.
 *
 * For every request:
 *   1. Build a per-request Supabase client that reads/writes auth cookies.
 *   2. Resolve the current user via `getUser()` (validates the JWT against the
 *      Supabase auth service — not just cookie presence).
 *   3. Resolve the user's profile (for `role`) and expose `supabase`, `user`,
 *      `session`, and `profile` on `event.locals`.
 *   4. If no user and the request isn't for an auth-only route, redirect to
 *      `/login`.
 *   5. If the request targets `/admin/*` or `/api/admin/*` and the profile
 *      isn't an admin, respond 404 (not redirect — don't reveal the route).
 *
 * The SPA still has `ssr = false`, but SvelteKit always runs `hooks.server.ts`
 * for the initial document request before client hydration takes over. That
 * is what makes the redirect-based guard work.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const supabase = createSupabaseServerClient(event.cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  event.locals.supabase = supabase;
  event.locals.user = user;
  event.locals.session = session;

  // Resolve the profile so downstream code (and the admin guard below) can
  // read `role`. A DB hiccup must never break auth: fall back to null, which
  // simply means admin routes 404 while normal auth still works.
  let profile: Profile | null = null;
  if (user) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
    } catch {
      profile = null;
    }
  }
  event.locals.profile = profile;

  const publicRoutes = new Set<string>(["/login", "/auth/callback"]);
  if (!user && !publicRoutes.has(event.url.pathname)) {
    throw redirect(303, "/login");
  }

  // Admin guard runs after auth + profile resolution. Unauthenticated users
  // never reach here (redirected above). 404 — not redirect — so the existence
  // of admin routes isn't leaked to non-admins.
  const path = event.url.pathname;
  const isAdminRoute =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/api/admin" ||
    path.startsWith("/api/admin/");
  if (isAdminRoute && profile?.role !== "admin") {
    throw error(404);
  }

  return resolve(event);
};
