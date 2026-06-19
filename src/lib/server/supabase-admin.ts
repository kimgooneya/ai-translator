/**
 * Supabase service_role admin client — bypasses Row Level Security.
 *
 * Server-only (`$lib/server/*`). NEVER import this from client code: the
 * service_role key has full DB access and must never reach the browser
 * bundle. Vite enforces this boundary via the `$lib/server` convention.
 *
 * Used for:
 *   - `provider_keys` reads + decryption (RLS blocks anon/auth on purpose)
 *   - `usage_logs` inserts (the table has no insert policy for anon/auth)
 *   - `provider_presets` reads (could go through the RLS-allowed anon client,
 *     but centralizing admin catalog access here keeps one code path)
 */

import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "$env/static/public";
import { SUPABASE_SERVICE_ROLE_KEY } from "$env/static/private";
import type { Database } from "$lib/supabase/database.types";

/**
 * Build a fresh service_role client. Per-call (not cached) so each request
 * gets an isolated instance — these are cheap to construct and avoid sharing
 * state across concurrent requests on the serverless runtime.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(
    PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        // service_role never authenticates as a user; persisting a session is
        // pointless and would leak state across invocations.
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
