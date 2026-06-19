import type { Handle } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { createSupabaseServerClient } from "$lib/supabase/server";

/**
 * Per-request auth gate.
 *
 * For every request:
 *   1. Build a per-request Supabase client that reads/writes auth cookies.
 *   2. Resolve the current user via `getUser()` (validates the JWT against the
 *      Supabase auth service — not just cookie presence).
 *   3. Expose `supabase`, `user`, and `session` on `event.locals`.
 *   4. If no user and the request isn't for an auth-only route, redirect to
 *      `/login`.
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

  const publicRoutes = new Set<string>(["/login", "/auth/callback"]);
  if (!user && !publicRoutes.has(event.url.pathname)) {
    throw redirect(303, "/login");
  }

  return resolve(event);
};
