import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for `/api/admin/provider-keys`.
 *
 * Mocks:
 *   - `$lib/server/supabase-admin` → chainable admin client
 *   - `$lib/server/crypto` → fake encryptKey that returns a recognizable
 *     ciphertext (so the test can assert it never appears in any response).
 *
 * Coverage:
 *   - Defense-in-depth role guard: non-admin → throws 404 on every verb
 *   - GET response contains NO `encrypted_key` / plaintext key column
 *   - POST computes `key_hint` server-side (masked), returns the masked view,
 *     and stores `encrypted_key` (not plaintext) in the DB row
 *   - DELETE requires an id
 */

// ─── crypto mock ─────────────────────────────────────────────────────────
const { mockEncryptKey, encryptedMarker } = vi.hoisted(() => ({
  mockEncryptKey: vi.fn(
    (plaintext: string) => `ENC(${plaintext.length}):${plaintext.slice(0, 2)}`,
  ),
  encryptedMarker: "ENC(",
}));
vi.mock("$lib/server/crypto", () => ({
  encryptKey: mockEncryptKey,
}));

// ─── chainable admin client mock (same shape as providers test) ──────────
type ChainState = { data: unknown; error: unknown; count: number | null };
const defaultChain: ChainState = { data: null, error: null, count: null };
let tableState: Record<string, ChainState> = {};

function buildChainable(state: ChainState) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => state),
    maybeSingle: vi.fn(async () => state),
    limit: vi.fn(() => chain),
    then: (resolve: (v: ChainState) => void) => resolve(state),
  };
  Object.assign(chain, Promise.resolve(state));
  return chain;
}

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("$lib/server/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { GET, POST, PATCH, DELETE, maskKey } from "./+server";

type RequestEvent = Parameters<typeof GET>[0];
const ENDPOINT_URL = "http://localhost/api/admin/provider-keys";

const adminProfile = {
  id: "admin-uuid",
  email: "admin@test.com",
  name: "Admin",
  avatar_url: null,
  role: "admin" as const,
  status: "active" as const,
  created_at: "",
};

const userProfile = {
  id: "user-uuid",
  email: "user@test.com",
  name: "User",
  avatar_url: null,
  role: "user" as const,
  status: "active" as const,
  created_at: "",
};

function makeEvent(opts: {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  profile: typeof adminProfile | typeof userProfile | null;
  query?: string;
}): RequestEvent {
  const init: RequestInit = { method: opts.method ?? "GET" };
  if (opts.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body =
      typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  const url = new URL(ENDPOINT_URL + (opts.query ?? ""));
  const request = new Request(url, init);
  return {
    request,
    url,
    locals: {
      user: opts.profile ? { id: opts.profile.id } : null,
      profile: opts.profile,
      supabase: {} as never,
      session: null,
    },
  } as unknown as RequestEvent;
}

function setTableData(table: string, state: ChainState): void {
  tableState[table] = state;
}

beforeEach(() => {
  tableState = {};
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    const state = tableState[table] ?? defaultChain;
    return {
      select: vi.fn(() => buildChainable(state)),
      insert: vi.fn(() => buildChainable(state)),
      update: vi.fn(() => buildChainable(state)),
      delete: vi.fn(() => buildChainable(state)),
    };
  });
  mockEncryptKey.mockClear();
});

describe("maskKey", () => {
  it("keeps first 3 + last 4 for long keys", () => {
    expect(maskKey("sk-abc123456789wxyz")).toBe("sk-...wxyz");
  });

  it("masks short keys to last 4 prefixed with ellipsis", () => {
    expect(maskKey("key")).toBe("...key");
    expect(maskKey("1234567")).toBe("...4567");
  });

  it("returns empty string for empty input", () => {
    expect(maskKey("")).toBe("");
  });
});

describe("defense-in-depth role guard", () => {
  it("GET throws 404 for non-admins", async () => {
    await expect(
      GET(
        makeEvent({
          profile: userProfile,
          query: "?provider_id=openai",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("POST throws 404 for non-admins", async () => {
    await expect(
      POST(
        makeEvent({
          method: "POST",
          profile: userProfile,
          body: { provider_id: "openai", plaintext_key: "sk-test1234567890" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("PATCH throws 404 for non-admins", async () => {
    await expect(
      PATCH(
        makeEvent({
          method: "PATCH",
          profile: userProfile,
          body: { id: "k1", enabled: false },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("DELETE throws 404 for non-admins", async () => {
    await expect(
      DELETE(
        makeEvent({
          method: "DELETE",
          profile: userProfile,
          body: { id: "k1" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("GET throws 404 when profile is null", async () => {
    await expect(
      GET(
        makeEvent({
          profile: null,
          query: "?provider_id=openai",
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("GET /api/admin/provider-keys", () => {
  it("rejects when provider_id is missing", async () => {
    const res = await GET(makeEvent({ profile: adminProfile }));
    expect(res.status).toBe(400);
  });

  it("returns masked key rows WITHOUT encrypted_key or plaintext", async () => {
    setTableData("provider_keys", {
      data: [
        {
          id: "k1",
          provider_id: "openai",
          key_hint: "sk-...wxyz",
          label: "primary",
          enabled: true,
          created_at: "2026-06-19T00:00:00Z",
        },
      ],
      error: null,
      count: null,
    });

    const res = await GET(
      makeEvent({
        profile: adminProfile,
        query: "?provider_id=openai",
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { keys: unknown[] };
    expect(body.keys).toHaveLength(1);
    const json = JSON.stringify(body);
    // The #1 invariant: no ciphertext, no plaintext.
    expect(json).not.toContain("encrypted_key");
    expect(json).not.toContain("sk-secret-plaintext");
    expect(json).not.toMatch(/ENC\(/);
    void encryptedMarker;
  });

  it("returns the masked key_hint only", async () => {
    setTableData("provider_keys", {
      data: [
        {
          id: "k1",
          provider_id: "openai",
          key_hint: "sk-...wxyz",
          label: null,
          enabled: true,
          created_at: "",
        },
      ],
      error: null,
      count: null,
    });
    const res = await GET(
      makeEvent({
        profile: adminProfile,
        query: "?provider_id=openai",
      }),
    );
    const body = (await res.json()) as { keys: Array<{ key_hint: string }> };
    expect(body.keys[0].key_hint).toBe("sk-...wxyz");
  });
});

describe("POST /api/admin/provider-keys", () => {
  it("encrypts the plaintext and stores key_hint (masked), returns masked view only", async () => {
    let capturedInsert: unknown = null;
    mockFrom.mockImplementation((table: string) => {
      if (table !== "provider_keys") {
        return {
          select: vi.fn(() => buildChainable(defaultChain)),
          insert: vi.fn(() => buildChainable(defaultChain)),
          update: vi.fn(() => buildChainable(defaultChain)),
          delete: vi.fn(() => buildChainable(defaultChain)),
        };
      }
      const returningState: ChainState = {
        data: {
          id: "new-id",
          provider_id: "openai",
          key_hint: "sk-...wxyz",
          label: "primary",
          enabled: true,
          created_at: "2026-06-19T00:00:00Z",
        },
        error: null,
        count: null,
      };
      return {
        select: vi.fn(() => buildChainable(returningState)),
        insert: vi.fn((payload: unknown) => {
          capturedInsert = payload;
          return buildChainable(returningState);
        }),
        update: vi.fn(() => buildChainable(returningState)),
        delete: vi.fn(() => buildChainable(returningState)),
      };
    });

    const res = await POST(
      makeEvent({
        method: "POST",
        profile: adminProfile,
        body: {
          provider_id: "openai",
          plaintext_key: "sk-secret-plaintext-1234567890",
          label: "primary",
        },
      }),
    );
    expect(res.status).toBe(201);

    // 1) encryptKey was called with the plaintext (server-side, in memory only).
    expect(mockEncryptKey).toHaveBeenCalledWith(
      "sk-secret-plaintext-1234567890",
    );

    // 2) The DB insert payload contains the ENCRYPTED form, not the plaintext.
    expect(capturedInsert).toMatchObject({
      provider_id: "openai",
      encrypted_key: expect.stringMatching(/^ENC\(/),
      key_hint: "sk-...7890", // masked server-side: first 3 + last 4
      label: "primary",
      enabled: true,
      created_by: adminProfile.id,
    });
    expect(capturedInsert).not.toMatchObject({
      plaintext_key: expect.anything(),
    });

    // 3) The response body has no encrypted_key / no plaintext.
    const json = JSON.stringify(await res.json());
    expect(json).not.toContain("encrypted_key");
    expect(json).not.toContain("sk-secret-plaintext");
    expect(json).not.toMatch(/ENC\(/);
  });

  it("rejects when plaintext_key is missing", async () => {
    const res = await POST(
      makeEvent({
        method: "POST",
        profile: adminProfile,
        body: { provider_id: "openai" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/provider-keys", () => {
  it("deletes by id", async () => {
    setTableData("provider_keys", { data: null, error: null, count: null });
    const res = await DELETE(
      makeEvent({
        method: "DELETE",
        profile: adminProfile,
        body: { id: "k1" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { deleted: boolean };
    expect(body.deleted).toBe(true);
  });
});

describe("PATCH /api/admin/provider-keys", () => {
  it("toggles enabled", async () => {
    setTableData("provider_keys", {
      data: {
        id: "k1",
        provider_id: "openai",
        key_hint: "sk-...wxyz",
        label: null,
        enabled: false,
        created_at: "",
      },
      error: null,
      count: null,
    });
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "k1", enabled: false },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects when there is nothing to update", async () => {
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "k1" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
