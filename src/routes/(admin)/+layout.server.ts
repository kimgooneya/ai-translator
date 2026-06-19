import { error } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

/**
 * Server-side admin guard for the `(admin)` route group.
 *
 * `hooks.server.ts` already 404s any `/admin/*` (or `/api/admin/*`) request
 * whose profile isn't an admin. This load function is the second layer of
 * defense: if the hooks guard ever regresses, or if this group is mounted
 * somewhere unexpected, this still throws 404 (not 403, not redirect —
 * admin existence must never leak to non-admins).
 *
 * Returns the acting admin's profile for the layout's user widget.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
  if (locals.profile?.role !== "admin") {
    throw error(404);
  }
  return { profile: locals.profile };
};
