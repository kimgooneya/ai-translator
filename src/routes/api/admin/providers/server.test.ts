import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Tests for `/api/admin/providers`.
 *
 * Mocks:
 *   - `$lib/server/supabase-admin` → chainable admin client (captured per call)
 *   - No crypto needed here (no keys are stored at this endpoint).
 *
 * Coverage:
 *   - Defense-in-depth role guard: non-admin → throws 404 (never reveals admin surface)
 *   - GET happy path: returns presets with aggregated `active_key_count`
 *   - POST happy path + validation: missing models → 400; default_model not in models → 400
 *   - PUT happy path
 *   - DELETE returns cascaded_keys_deleted count
 */

// ─── chainable admin client mock ─────────────────────────────────────────
// Each chainable builder captures the args and returns itself so the chain
// `.from().select().eq().order()` resolves. The terminal response (`data`,
// `error`, `count`) is configurable per-table per-test via `setTableState`.

type ChainState = {
  data: unknown;
  error: unknown;
  count: number | null;
};

type TableState = Record<string, ChainState> & {
  __overrides?: Record<
    string,
    Partial<{
      select: ChainState;
      insert: ChainState;
      update: ChainState;
      delete: ChainState;
      selectCount: ChainState;
      selectHead: ChainState;
    }>
  >;
};

const defaultChain: ChainState = { data: null, error: null, count: null };

let tableState: TableState = {};

function buildChainable(state: ChainState) {
  const chain = {
    select: vi.fn(() => chain),
    select_head: vi.fn(() => chain),
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
    // Terminal resolver for non-single() calls. The handler awaits the
    // chain itself, so the object must be thenable.
    then: (resolve: (v: ChainState) => void) => resolve(state),
  };
  // Make the chain awaitable directly (handlers do `await query`).
  const promise = Promise.resolve(state);
  Object.assign(chain, promise);
  return chain;
}

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("$lib/server/supabase-admin", () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

// Imported AFTER vi.mock so the module is replaced first.
import { GET, POST, PUT, DELETE } from "./+server";

type RequestEvent = Parameters<typeof GET>[0];
const ENDPOINT_URL = "http://localhost/api/admin/providers";

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
  method?: "GET" | "POST" | "PUT" | "DELETE";
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

/** Configure the admin client mock for the given table + operation. */
function setTableData(
  table: string,
  state: ChainState,
  op:
    | "default"
    | "select"
    | "insert"
    | "update"
    | "delete"
    | "selectHead" = "default",
): void {
  if (!tableState[table]) tableState[table] = { ...defaultChain };
  if (op === "default") {
    tableState[table] = { ...state };
  } else {
    if (!tableState.__overrides) tableState.__overrides = {};
    if (!tableState.__overrides[table]) tableState.__overrides[table] = {};
    tableState.__overrides[table][op] = state;
  }
}

function applyOverrides(
  table: string,
  op: "select" | "insert" | "update" | "delete" | "selectHead",
): ChainState {
  const override = tableState.__overrides?.[table]?.[op];
  return override ?? tableState[table] ?? defaultChain;
}

beforeEach(() => {
  tableState = {};
  mockFrom.mockReset();
  mockFrom.mockImplementation((table: string) => {
    // Detect head-count selects by inspecting the chain call below.
    const chainable = {
      select: vi.fn(
        (cols?: string | object, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head)
            return buildChainable(applyOverrides(table, "selectHead"));
          void cols;
          return buildChainable(applyOverrides(table, "select"));
        },
      ),
      insert: vi.fn(() => buildChainable(applyOverrides(table, "insert"))),
      update: vi.fn(() => buildChainable(applyOverrides(table, "update"))),
      delete: vi.fn(() => buildChainable(applyOverrides(table, "delete"))),
    };
    return chainable;
  });
});

describe("GET /api/admin/providers", () => {
  it("throws 404 when profile.role is not admin (defense-in-depth)", async () => {
    await expect(
      GET(makeEvent({ profile: userProfile })),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("throws 404 when profile is null", async () => {
    await expect(GET(makeEvent({ profile: null }))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("returns presets with active_key_count aggregated from provider_keys", async () => {
    setTableData("provider_presets", {
      data: [
        {
          id: "openai",
          display_name: "OpenAI",
          base_url: "https://api.openai.com/v1",
          models: ["gpt-5.4"],
          default_model: "gpt-5.4",
          enabled: true,
          sort_order: 1,
          created_at: "",
          updated_at: "",
          updated_by: null,
        },
      ],
      error: null,
      count: null,
    });
    setTableData("provider_keys", {
      data: [
        { provider_id: "openai" },
        { provider_id: "openai" },
        { provider_id: "gemini" },
      ],
      error: null,
      count: null,
    });

    const res = await GET(makeEvent({ profile: adminProfile }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      presets: Array<{ active_key_count: number }>;
    };
    expect(body.presets).toHaveLength(1);
    expect(body.presets[0].active_key_count).toBe(2);
  });
});

describe("POST /api/admin/providers", () => {
  it("throws 404 for non-admins", async () => {
    await expect(
      POST(
        makeEvent({
          method: "POST",
          profile: userProfile,
          body: {
            id: "openai",
            display_name: "OpenAI",
            base_url: "https://api.openai.com/v1",
            models: ["gpt-5.4"],
            default_model: "gpt-5.4",
          },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects when models is empty", async () => {
    const res = await POST(
      makeEvent({
        method: "POST",
        profile: adminProfile,
        body: {
          id: "x",
          display_name: "X",
          base_url: "https://x",
          models: [],
          default_model: "anything",
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects when default_model is not in models", async () => {
    const res = await POST(
      makeEvent({
        method: "POST",
        profile: adminProfile,
        body: {
          id: "x",
          display_name: "X",
          base_url: "https://x",
          models: ["gpt-5.4"],
          default_model: "gpt-4",
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates a preset and returns 201", async () => {
    setTableData("provider_presets", {
      data: {
        id: "x",
        display_name: "X",
        base_url: "https://x",
        models: ["m1"],
        default_model: "m1",
        enabled: true,
        sort_order: 0,
        created_at: "",
        updated_at: "",
        updated_by: adminProfile.id,
      },
      error: null,
      count: null,
    });

    const res = await POST(
      makeEvent({
        method: "POST",
        profile: adminProfile,
        body: {
          id: "x",
          display_name: "X",
          base_url: "https://x",
          models: ["m1"],
          default_model: "m1",
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.preset.id).toBe("x");
  });
});

describe("PUT /api/admin/providers", () => {
  it("throws 404 for non-admins", async () => {
    await expect(
      PUT(
        makeEvent({
          method: "PUT",
          profile: userProfile,
          body: { id: "x", enabled: false },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("updates fields and stamps updated_by/updated_at", async () => {
    setTableData("provider_presets", {
      data: {
        id: "x",
        display_name: "Updated",
        base_url: "https://x",
        models: ["m1"],
        default_model: "m1",
        enabled: false,
        sort_order: 0,
        created_at: "",
        updated_at: "",
        updated_by: adminProfile.id,
      },
      error: null,
      count: null,
    });

    const res = await PUT(
      makeEvent({
        method: "PUT",
        profile: adminProfile,
        body: { id: "x", enabled: false },
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/admin/providers", () => {
  it("throws 404 for non-admins", async () => {
    await expect(
      DELETE(
        makeEvent({
          method: "DELETE",
          profile: userProfile,
          body: { id: "x" },
        }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("deletes and reports cascaded_keys_deleted count", async () => {
    setTableData("provider_keys", {
      data: null,
      error: null,
      count: 3,
    });
    setTableData("provider_presets", {
      data: null,
      error: null,
      count: null,
    });

    const res = await DELETE(
      makeEvent({
        method: "DELETE",
        profile: adminProfile,
        body: { id: "openai" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      deleted: boolean;
      cascaded_keys_deleted: number;
    };
    expect(body.deleted).toBe(true);
    expect(body.cascaded_keys_deleted).toBe(3);
  });
});
