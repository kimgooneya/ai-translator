import { createBrowserClient } from "@supabase/ssr";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
} from "$env/static/public";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client (singleton). The anon key is safe to expose —
 * Row Level Security on every table is the actual security boundary.
 */
export const supabaseBrowser = createBrowserClient<Database>(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
);
