/**
 * In-memory Supabase mock + settable auth stores for unit tests.
 *
 * Installed globally via `vi.mock` in `tests/setup.ts`. Tests that need to
 * drive the mock (seed/reset/inspect tables, flip the signed-in user) import
 * the helpers below directly from `tests/supabase-mock`.
 *
 * The mock is intentionally narrow: it implements only the chain shapes used
 * by `src/lib/stores/{history,glossary,auth}.ts` — `from(t).{select,insert,
 * update,delete}(...).{eq,in,order,limit,range,maybeSingle,single}` and the
 * `auth.{getSession,onAuthStateChange,signOut}` surface. Anything else will
 * throw, which is a feature: it surfaces unintended coupling in tests.
 *
 * Conventions matching real supabase-js:
 *   - Insert without an explicit `id` → mock auto-generates a uuid-like id.
 *   - Insert/update auto-fills `created_at`/`updated_at` when absent.
 *   - `.single()` / `.maybeSingle()` unwrap to `{data: row | null, error}`.
 *   - The builder itself is thennable for terminal awaits without `.single()`
 *     (e.g., `await supabase.from(t).delete().eq(...)`).
 */

import { writable, type Writable } from "svelte/store";

// ─── Types ────────────────────────────────────────────────────────────────

export type Row = Record<string, unknown>;

export type MockUser = { id: string; email?: string | null } | null;

export type MockSession = {
  user: MockUser;
  access_token?: string;
} | null;

type Filter = { column: string; op: "eq" | "in"; value: unknown };
type Order = { column: string; ascending: boolean };

type QueryState = {
  table: string;
  action: "pending" | "select" | "insert" | "update" | "delete";
  filters: Filter[];
  order: Order | null;
  limitN: number | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  selectCols: string | null;
  wantsReturn: boolean;
  insertPayload: Row[] | null;
  updatePayload: Row | null;
};

type Result<TData> = { data: TData; error: null };

// ─── Singleton in-memory state ────────────────────────────────────────────
// Lives at module scope so the same instance is shared with the `vi.mock`
// factory in setup.ts (which runs lazily on first import of the mocked
// module). Tests reset/seed via the exported helpers below.

const TABLE_NAMES = [
  "profiles",
  "translation_history",
  "glossaries",
  "glossary_entries",
] as const;

type TableName = (typeof TABLE_NAMES)[number];

const state: {
  tables: Record<TableName, Row[]>;
  /** Monotonic counter for generated ids; deterministic across a test run. */
  idCounter: number;
  /** Captured `onAuthStateChange` callback, so tests can fire events. */
  authCallback: ((event: string, session: MockSession) => void) | null;
  /** Currently signed-in user (the source of truth for the auth stores). */
  user: MockUser;
} = {
  tables: {
    profiles: [],
    translation_history: [],
    glossaries: [],
    glossary_entries: [],
  },
  idCounter: 0,
  authCallback: null,
  user: { id: "test-user-id", email: "test@test.com" },
};

const DEFAULT_USER: NonNullable<MockUser> = {
  id: "test-user-id",
  email: "test@test.com",
};

function nextId(): string {
  return `mock-uuid-${++state.idCounter}`;
}

// ─── Query builder ────────────────────────────────────────────────────────

class MockQueryBuilder implements PromiseLike<Result<Row[] | null>> {
  private s: QueryState = {
    table: "",
    action: "pending",
    filters: [],
    order: null,
    limitN: null,
    rangeFrom: null,
    rangeTo: null,
    selectCols: null,
    wantsReturn: false,
    insertPayload: null,
    updatePayload: null,
  };

  constructor(table: string) {
    this.s.table = table;
  }

  // Chainable methods
  select(cols: string = "*"): this {
    if (this.s.action === "pending") this.s.action = "select";
    this.s.selectCols = cols;
    this.s.wantsReturn = true;
    return this;
  }
  insert(payload: Row | Row[]): this {
    this.s.action = "insert";
    this.s.insertPayload = Array.isArray(payload) ? payload : [payload];
    return this;
  }
  update(payload: Row): this {
    this.s.action = "update";
    this.s.updatePayload = payload;
    return this;
  }
  delete(): this {
    this.s.action = "delete";
    return this;
  }
  eq(column: string, value: unknown): this {
    this.s.filters.push({ column, op: "eq", value });
    return this;
  }
  in(column: string, value: unknown[]): this {
    this.s.filters.push({ column, op: "in", value });
    return this;
  }
  order(column: string, opts: { ascending?: boolean } = {}): this {
    this.s.order = { column, ascending: opts.ascending ?? true };
    return this;
  }
  limit(n: number): this {
    this.s.limitN = n;
    return this;
  }
  range(from: number, to: number): this {
    this.s.rangeFrom = from;
    this.s.rangeTo = to;
    return this;
  }

  // Terminal methods
  async maybeSingle(): Promise<Result<Row | null>> {
    const { data } = await this.execute();
    return { data: (data?.[0] as Row | undefined) ?? null, error: null };
  }
  async single(): Promise<Result<Row | null>> {
    const { data } = await this.execute();
    return { data: (data?.[0] as Row | undefined) ?? null, error: null };
  }

  // Thennable: `await supabase.from(t).select(...).eq(...)` resolves directly.
  // JS recognizes a thenable by its `.then` method.
  then<TResult1 = Result<Row[] | null>, TResult2 = never>(
    onFulfilled?:
      | ((value: Result<Row[] | null>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  // Core engine
  private async execute(): Promise<Result<Row[] | null>> {
    const { table, action } = this.s;
    if (!TABLE_NAMES.includes(table as TableName)) {
      throw new Error(
        `[supabase-mock] unknown table "${table}". Known: ${TABLE_NAMES.join(", ")}`,
      );
    }
    const tableRows = state.tables[table as TableName];

    // Filter
    let matched = tableRows.filter((row) =>
      this.s.filters.every((f) => {
        if (f.op === "eq") return row[f.column] === f.value;
        if (f.op === "in")
          return (f.value as unknown[]).includes(row[f.column]);
        return true;
      }),
    );

    // Order
    if (this.s.order) {
      const { column, ascending } = this.s.order;
      matched = [...matched].sort((a, b) => {
        const av = a[column] as number | string | undefined;
        const bv = b[column] as number | string | undefined;
        if (av === bv) return 0;
        if (av === undefined || av === null) return ascending ? -1 : 1;
        if (bv === undefined || bv === null) return ascending ? 1 : -1;
        return av < bv ? (ascending ? -1 : 1) : ascending ? 1 : -1;
      });
    }

    // Slice: range is inclusive in supabase-js; limit is a top-N.
    if (this.s.rangeFrom !== null && this.s.rangeTo !== null) {
      matched = matched.slice(this.s.rangeFrom, this.s.rangeTo + 1);
    } else if (this.s.limitN !== null) {
      matched = matched.slice(0, this.s.limitN);
    }

    if (action === "select") {
      return { data: this.project(matched), error: null };
    }

    if (action === "insert") {
      const inserted: Row[] = [];
      for (const p of this.s.insertPayload ?? []) {
        const now = new Date().toISOString();
        const row: Row = { id: nextId(), created_at: now, updated_at: now };
        for (const [k, v] of Object.entries(p)) {
          // Don't overwrite the generated id/created_at if the payload
          // didn't explicitly provide one.
          if (k === "id" && p.id) row.id = v as string;
          else if (k === "created_at" && p.created_at)
            row.created_at = v as string;
          else if (k === "updated_at" && p.updated_at)
            row.updated_at = v as string;
          else row[k] = v;
        }
        tableRows.push(row);
        inserted.push(row);
      }
      return {
        data: this.s.wantsReturn ? this.project(inserted) : null,
        error: null,
      };
    }

    if (action === "update") {
      const patch = this.s.updatePayload ?? {};
      const updated: Row[] = [];
      for (const row of matched) {
        // Apply patch. Auto-bump updated_at when present on the row.
        if ("updated_at" in row && patch.updated_at === undefined) {
          Object.assign(row, patch, { updated_at: new Date().toISOString() });
        } else {
          Object.assign(row, patch);
        }
        updated.push(row);
      }
      return {
        data: this.s.wantsReturn ? this.project(updated) : null,
        error: null,
      };
    }

    if (action === "delete") {
      const toRemove = new Set(matched.map((r) => r.id));
      const newTable = tableRows.filter((r) => !toRemove.has(r.id));
      state.tables[table as TableName] = newTable;
      return {
        data: this.s.wantsReturn ? this.project(matched) : null,
        error: null,
      };
    }

    return { data: null, error: null };
  }

  /** Project rows to the selected columns (or pass through for "*"). */
  private project(rows: Row[]): Row[] {
    const cols = this.s.selectCols;
    if (!cols || cols === "*") return rows.map((r) => ({ ...r }));
    const colList = cols.split(",").map((c) => c.trim());
    return rows.map((r) => {
      const proj: Row = {};
      for (const c of colList) proj[c] = r[c];
      return proj;
    });
  }
}

// ─── Mock client (the actual singleton exposed via vi.mock) ───────────────

export const mockSupabaseBrowser = {
  from(table: string): MockQueryBuilder {
    return new MockQueryBuilder(table);
  },
  auth: {
    getSession: (): Promise<{ data: { session: MockSession } }> => {
      const session: MockSession = state.user
        ? { user: state.user, access_token: "mock-access-token" }
        : null;
      return Promise.resolve({ data: { session } });
    },
    onAuthStateChange: (
      cb: (event: string, session: MockSession) => void,
    ): {
      data: { subscription: { unsubscribe: () => void } };
    } => {
      state.authCallback = cb;
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              if (state.authCallback === cb) state.authCallback = null;
            },
          },
        },
      };
    },
    signOut: (): Promise<{ error: null }> => {
      return Promise.resolve({ error: null });
    },
  },
};

// ─── Auth store mocks (settable; default to a stub logged-in user) ─────────
// Typed loosely: real `User`/`Session` from supabase-js carry many fields we
// don't exercise. Tests that care about specific user fields should pass a
// richer shape via `setMockUser`.

export const mockUserStore: Writable<MockUser> = writable<MockUser>(state.user);
export const mockSessionStore: Writable<MockSession> = writable<MockSession>(
  state.user ? { user: state.user, access_token: "mock-access-token" } : null,
);
export const mockProfileStore: Writable<Row | null> = writable<Row | null>(
  null,
);

// ─── Test helpers ─────────────────────────────────────────────────────────

/**
 * Reset the in-memory tables, id counter, and auth callback to a clean slate.
 * Called automatically in `afterEach` from setup.ts; safe to call manually
 * inside a `beforeEach` for a fresh table state mid-test-file.
 */
export function resetMockSupabase(): void {
  for (const t of TABLE_NAMES) state.tables[t] = [];
  state.idCounter = 0;
  state.authCallback = null;
  // Reset user to default; downstream stores see a change and re-fetch.
  setMockUser(DEFAULT_USER);
}

/**
 * Replace the rows of a table. The previous contents are discarded.
 * Asserts the table name is one of the known set so a typo fails loudly.
 */
export function seedTable(table: TableName, rows: Row[]): void {
  if (!TABLE_NAMES.includes(table)) {
    throw new Error(
      `[supabase-mock] cannot seed unknown table "${String(table)}"`,
    );
  }
  state.tables[table] = rows.map((r) => ({ ...r }));
}

/**
 * Read-only snapshot of a table's current rows. Returns a defensive copy so
 * tests can `expect(...).toMatchObject` without mutating mock state.
 */
export function getMockTable<T = Row>(table: TableName): T[] {
  if (!TABLE_NAMES.includes(table)) {
    throw new Error(
      `[supabase-mock] cannot read unknown table "${String(table)}"`,
    );
  }
  return state.tables[table].map((r) => ({ ...r })) as T[];
}

/** Current signed-in user (or null when signed out). */
export function getMockUser(): MockUser {
  return state.user;
}

/**
 * Flip the signed-in user. Updates `state.user` and emits from `mockUserStore`
 * so that the real stores (`history`, `glossary`) — which subscribe to
 * `userStore` — re-fetch from the (mocked) Supabase tables.
 *
 * Pass `null` to simulate "signed out"; the stores will clear.
 */
export function setMockUser(user: MockUser): void {
  state.user = user;
  mockUserStore.set(user);
  mockSessionStore.set(
    user ? { user, access_token: "mock-access-token" } : null,
  );
}

/** Drain pending microtasks. Useful after `setMockUser` to let async
 *  re-fetches (`loadHistory`/`loadGlossary`) settle before asserting. */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
