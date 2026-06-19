import { createBrowserClient } from "@supabase/ssr";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
} from "$env/static/public";
import type { Database } from "./database.types";

/**
 * Browser-side Supabase client (singleton). The publishable key
 * (`sb_publishable_...`) is safe to expose — Row Level Security on every
 * table is the actual security boundary.
 */
export const supabaseBrowser = createBrowserClient<Database>(
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
