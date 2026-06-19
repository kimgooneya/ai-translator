/**
 * Auth stores backed by the Supabase browser client.
 *
 * Contract (other agents depend on this):
 *   - `sessionStore`  — Reflects the current Supabase auth `Session` (or null).
 *   - `userStore`     — Derived `User` from the session (or null).
 *   - `profileStore`  — The user's row from `public.profiles`; refetched
 *                       automatically whenever `userStore` changes.
 *   - `signOut()`     — Tears down the Supabase session and resets the stores
 *                       synchronously. The caller is responsible for redirect.
 *
 * Initialization is eager: at module load we kick off `getSession()` and
 * subscribe to `onAuthStateChange`. Both are no-ops in jsdom when the Supabase
 * module is mocked to return a null session, so the initial synchronous reads
 * of any of the stores are always `null`.
 */

import { writable, derived, type Readable } from "svelte/store";
import type { Session, User } from "@supabase/supabase-js";
import { supabaseBrowser } from "$lib/supabase/client";
import type { Profile } from "$lib/supabase/database.types";

// -----------------------------------------------------------------------------
// sessionStore
// -----------------------------------------------------------------------------

const sessionInternal = writable<Session | null>(null);

/** Bootstrap from any persisted cookie session, then track live changes. */
void supabaseBrowser.auth.getSession().then(({ data }) => {
  sessionInternal.set(data.session);
});

supabaseBrowser.auth.onAuthStateChange((_event, session) => {
  sessionInternal.set(session);
});

export const sessionStore: Readable<Session | null> = {
  subscribe: sessionInternal.subscribe,
};

// -----------------------------------------------------------------------------
// userStore
// -----------------------------------------------------------------------------

export const userStore: Readable<User | null> = derived(
  sessionStore,
  ($session) => $session?.user ?? null,
);

// -----------------------------------------------------------------------------
// profileStore
// -----------------------------------------------------------------------------

const profileInternal = writable<Profile | null>(null);

/**
 * Refetch the profile row whenever the user id changes. The `handle_new_user`
 * SQL trigger guarantees a `profiles` row exists for every `auth.users` row,
 * so a non-null user should always resolve to a non-null profile — but we
 * still tolerate null (e.g. the trigger racing slightly behind signup).
 */
let lastUserId: string | null | undefined = undefined;
userStore.subscribe((user) => {
  const id = user?.id ?? null;
  if (id === lastUserId) return;
  lastUserId = id;

  if (!id) {
    profileInternal.set(null);
    return;
  }

  void supabaseBrowser
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle()
    .then(({ data }) => {
      // Coerce — the generated Database type narrows this to `Profile`.
      profileInternal.set((data as Profile | null) ?? null);
    });
});

export const profileStore: Readable<Profile | null> = {
  subscribe: profileInternal.subscribe,
};

// -----------------------------------------------------------------------------
// signOut
// -----------------------------------------------------------------------------

/**
 * Signs the user out of Supabase and resets the auth stores synchronously.
 * The caller is responsible for navigating to `/login` (or wherever) — this
 * function intentionally does not perform a redirect so the caller controls UX.
 */
export async function signOut(): Promise<void> {
  await supabaseBrowser.auth.signOut();
  // Reset synchronously so the UI can react before the
  // `onAuthStateChange` event round-trips through Supabase.
  sessionInternal.set(null);
  profileInternal.set(null);
}
