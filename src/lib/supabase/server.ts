import { createServerClient } from "@supabase/ssr";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
} from "$env/static/public";
import type { Cookies } from "@sveltejs/kit";
import type { Database } from "./database.types";

/**
 * Build a per-request Supabase client that reads/writes the auth session in
 * cookies. Used inside hooks.server.ts and any +server / +layout.server files.
 */
export function createSupabaseServerClient(cookies: Cookies) {
  return createServerClient<Database>(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookies.getAll();
        },
        setAll(items) {
          for (const { name, value, options } of items) {
            cookies.set(name, value, { ...options, path: "/" });
          }
        },
      },
    },
  );
}
