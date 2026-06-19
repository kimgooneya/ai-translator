// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Project runs vitest with `globals: true`; type the global vi/describe/it/etc.
// (additive ambient reference; does not alter compilerOptions.types).
/// <reference types="vitest/globals" />

import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import type { Database, Profile } from "$lib/supabase/database.types";

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      supabase: SupabaseClient<Database>;
      session: Session | null;
      user: User | null;
      profile: Profile | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
