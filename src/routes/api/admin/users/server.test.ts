import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for `/api/admin/users`.
 *
 * Coverage:
 *   - Defense-in-depth role guard: non-admin → throws 404
 *   - GET returns paginated users with usage_count aggregation
 *   - PATCH role change works
 *   - PATCH self-demotion (admin → user) is blocked with 400
 *   - PATCH self-suspension is blocked with 400
 *   - Promoting another user / suspending another user is allowed
 */

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
    range: vi.fn(() => chain),
    or: vi.fn(() => chain),
    in: vi.fn(() => chain),
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

import { GET, PATCH } from "./+server";

type RequestEvent = Parameters<typeof GET>[0];
const ENDPOINT_URL = "http://localhost/api/admin/users";

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
  method?: "GET" | "PATCH";
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
});

describe("defense-in-depth role guard", () => {
  it("GET throws 404 for non-admins", async () => {
    await expect(
      GET(makeEvent({ profile: userProfile })),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("PATCH throws 404 for non-admins", async () => {
    await expect(
      PATCH(
        makeEvent({
          method: "PATCH",
          profile: userProfile,
          body: { id: "x", role: "admin" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("GET throws 404 when profile is null", async () => {
    await expect(GET(makeEvent({ profile: null }))).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("GET /api/admin/users", () => {
  it("returns users with usage_count aggregation", async () => {
    setTableData("profiles", {
      data: [
        {
          id: "u1",
          email: "u1@test.com",
          name: "U1",
          avatar_url: null,
          role: "user",
          status: "active",
          created_at: "2026-06-19T00:00:00Z",
        },
      ],
      error: null,
      count: 1,
    });
    setTableData("usage_logs", {
      data: [
        { user_id: "u1", input_chars: 10, output_chars: 5 },
        { user_id: "u1", input_chars: 20, output_chars: 15 },
      ],
      error: null,
      count: null,
    });

    const res = await GET(makeEvent({ profile: adminProfile }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      users: Array<{ usage_count: number; total_chars: number }>;
      total: number;
    };
    expect(body.users).toHaveLength(1);
    expect(body.users[0].usage_count).toBe(2);
    expect(body.users[0].total_chars).toBe(50); // 10+5+20+15
    expect(body.total).toBe(1);
  });

  it("handles empty user list", async () => {
    setTableData("profiles", { data: [], error: null, count: 0 });
    setTableData("usage_logs", { data: [], error: null, count: null });
    const res = await GET(makeEvent({ profile: adminProfile }));
    const body = (await res.json()) as { users: unknown[]; total: number };
    expect(body.users).toEqual([]);
    expect(body.total).toBe(0);
  });
});

describe("PATCH /api/admin/users", () => {
  it("BLOCKS self-demotion (admin → user)", async () => {
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: adminProfile.id, role: "user" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("BLOCKS self-suspension", async () => {
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: adminProfile.id, status: "suspended" },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("ALLOWS promoting another user to admin", async () => {
    setTableData("profiles", {
      data: {
        id: "u1",
        email: "u1@test.com",
        name: "U1",
        avatar_url: null,
        role: "admin",
        status: "active",
        created_at: "",
      },
      error: null,
      count: null,
    });
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "u1", role: "admin" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("ALLOWS suspending another user", async () => {
    setTableData("profiles", {
      data: {
        id: "u1",
        email: "u1@test.com",
        name: "U1",
        avatar_url: null,
        role: "user",
        status: "suspended",
        created_at: "",
      },
      error: null,
      count: null,
    });
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "u1", status: "suspended" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("ALLOWS the admin to update their own status back to active", async () => {
    setTableData("profiles", {
      data: {
        ...adminProfile,
        status: "active",
      },
      error: null,
      count: null,
    });
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: adminProfile.id, status: "active" },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects when there is nothing to update", async () => {
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "u1" },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid role value", async () => {
    const res = await PATCH(
      makeEvent({
        method: "PATCH",
        profile: adminProfile,
        body: { id: "u1", role: "superadmin" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
