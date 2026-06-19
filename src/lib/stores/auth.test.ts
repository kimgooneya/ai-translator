import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";

// Hoisted mock for the Supabase browser client. The auth store kicks off
// `getSession()` and `onAuthStateChange` at module load, so the mock must be
// in place before `./auth` is imported below. `vi.mock` is hoisted by Vitest
// above all imports, which satisfies that ordering.
vi.mock("$lib/supabase/client", () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });

  return {
    supabaseBrowser: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn().mockReturnValue({ select }),
    },
  };
});

// `tests/setup.ts` installs a global `$lib/stores/auth` mock for the rest of
// the suite; this file is the one place that exercises the *real* auth
// module, so undo the global mock via `importActual`.
vi.mock(
  "$lib/stores/auth",
  async () => await vi.importActual("$lib/stores/auth"),
);

const { sessionStore, userStore, profileStore, signOut } =
  await import("./auth");
const { supabaseBrowser } = await import("$lib/supabase/client");

describe("auth store", () => {
  it("exposes a null session before Supabase resolves", () => {
    expect(get(sessionStore)).toBeNull();
  });

  it("exposes a null user before Supabase resolves", () => {
    expect(get(userStore)).toBeNull();
  });

  it("exposes a null profile before Supabase resolves", () => {
    expect(get(profileStore)).toBeNull();
  });

  it("signOut() delegates to supabaseBrowser.auth.signOut() and resets the stores", async () => {
    const callsBefore = vi.mocked(supabaseBrowser.auth.signOut).mock.calls
      .length;
    await signOut();
    expect(vi.mocked(supabaseBrowser.auth.signOut).mock.calls.length).toBe(
      callsBefore + 1,
    );
    expect(get(sessionStore)).toBeNull();
    expect(get(profileStore)).toBeNull();
  });
});
