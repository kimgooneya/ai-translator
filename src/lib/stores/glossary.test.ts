import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import {
  glossaryStore,
  addEntry,
  updateEntry,
  removeEntry,
  toggleEnabled,
  generateEntryId,
} from "$lib/stores/glossary";
import type { GlossaryEntry } from "$lib/schemas";
import type {
  GlossaryEntryRow,
  GlossaryRow,
} from "$lib/supabase/database.types";
import {
  getMockTable,
  resetMockSupabase,
  seedTable,
} from "../../../tests/supabase-mock";

function entry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: "g-1",
    source: "RAG",
    target: "검색 증강 생성",
    ...overrides,
  };
}

// The glossary store creates a parent `glossaries` row lazily on first
// mutation (`ensureGlossaryId`), but `toggleEnabled` only updates an existing
// row. Pre-seed the parent row in beforeEach to mirror what the
// `handle_new_user` SQL trigger would have created — otherwise tests that
// toggle without first adding an entry see an empty table.
beforeEach(() => {
  resetMockSupabase();
  seedTable("glossaries", [
    {
      id: "test-glossary-id",
      user_id: "test-user-id",
      enabled: false,
      created_at: "2025-01-01T00:00:00.000Z",
    },
  ]);
  glossaryStore.set({ enabled: false, entries: [] });
});

describe("glossaryStore", () => {
  describe("initial state", () => {
    it("starts with enabled=false and an empty entries array", () => {
      const value = get(glossaryStore);
      expect(value).toEqual({ enabled: false, entries: [] });
    });
  });

  describe("addEntry", () => {
    it("appends a new entry to the entries array", async () => {
      await addEntry(entry());
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0]).toMatchObject({
        source: "RAG",
        target: "검색 증강 생성",
      });
    });

    it("does not mutate or replace existing entries", async () => {
      await addEntry(entry({ id: "g-1", source: "A" }));
      await addEntry(entry({ id: "g-2", source: "B" }));
      const value = get(glossaryStore);
      expect(value.entries.map((e) => e.source)).toEqual(["A", "B"]);
    });

    it("persists the new entry to the glossary_entries table", async () => {
      await addEntry(entry({ id: "persist-1", source: "RAG" }));
      const rows = getMockTable<GlossaryEntryRow>("glossary_entries");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        source: "RAG",
        target: "검색 증강 생성",
      });
    });

    it("accepts an entry with an optional note", async () => {
      await addEntry(entry({ note: "전문 용어" }));
      const value = get(glossaryStore);
      expect(value.entries[0].note).toBe("전문 용어");
    });
  });

  describe("updateEntry", () => {
    it("patches the matching entry by id", async () => {
      await addEntry(entry({ id: "g-1", source: "old", target: "옛날" }));
      const persistedId = get(glossaryStore).entries[0].id;
      await updateEntry(persistedId, { source: "new" });
      const value = get(glossaryStore);
      expect(value.entries[0]).toMatchObject({ source: "new", target: "옛날" });
    });

    it("preserves fields that are not in the patch", async () => {
      await addEntry(entry({ id: "g-1", source: "s", target: "t", note: "n" }));
      const persistedId = get(glossaryStore).entries[0].id;
      await updateEntry(persistedId, { target: "t2" });
      const value = get(glossaryStore);
      expect(value.entries[0]).toMatchObject({
        source: "s",
        target: "t2",
        note: "n",
      });
    });

    it("is a no-op when the id does not exist", async () => {
      await addEntry(entry({ id: "g-1" }));
      await updateEntry("g-missing", { source: "x" });
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0].source).toBe("RAG");
    });

    it("updates only the targeted entry when multiple exist", async () => {
      await addEntry(entry({ id: "g-1", source: "A" }));
      await addEntry(entry({ id: "g-2", source: "B" }));
      const secondId = get(glossaryStore).entries[1].id;
      await updateEntry(secondId, { source: "B2" });
      const value = get(glossaryStore);
      expect(value.entries.map((e) => e.source)).toEqual(["A", "B2"]);
    });
  });

  describe("removeEntry", () => {
    it("removes the entry with the given id", async () => {
      await addEntry(entry({ id: "g-1" }));
      const persistedId = get(glossaryStore).entries[0].id;
      await removeEntry(persistedId);
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(0);
    });

    it("leaves other entries untouched", async () => {
      await addEntry(entry({ id: "g-1", source: "A" }));
      await addEntry(entry({ id: "g-2", source: "B" }));
      const firstId = get(glossaryStore).entries[0].id;
      await removeEntry(firstId);
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0].source).toBe("B");
    });

    it("is a no-op when the id does not exist", async () => {
      await addEntry(entry({ id: "g-1" }));
      await removeEntry("g-missing");
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
    });
  });

  describe("toggleEnabled", () => {
    it("flips enabled from false to true", async () => {
      expect(get(glossaryStore).enabled).toBe(false);
      await toggleEnabled();
      expect(get(glossaryStore).enabled).toBe(true);
    });

    it("flips enabled from true back to false", async () => {
      await toggleEnabled();
      await toggleEnabled();
      expect(get(glossaryStore).enabled).toBe(false);
    });

    it("does not touch the entries array", async () => {
      await addEntry(entry({ id: "g-1" }));
      await toggleEnabled();
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
    });

    it("persists the enabled flag to the glossaries table", async () => {
      await toggleEnabled();
      const rows = getMockTable<GlossaryRow>("glossaries");
      expect(rows).toHaveLength(1);
      expect(rows[0].enabled).toBe(true);
    });
  });

  describe("generateEntryId", () => {
    it("returns a string prefixed with glossary-", () => {
      expect(generateEntryId()).toMatch(/^glossary-/);
    });

    it("generates unique ids across calls", () => {
      const a = generateEntryId();
      const b = generateEntryId();
      expect(a).not.toBe(b);
    });
  });

  describe("schema compliance", () => {
    it("round-trips source/target/note through the glossary_entries table", async () => {
      await addEntry(
        entry({
          id: "g-1",
          source: "RAG",
          target: "검색 증강 생성",
          note: "메모",
        }),
      );
      await toggleEnabled();
      const entries = getMockTable<GlossaryEntryRow>("glossary_entries");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        source: "RAG",
        target: "검색 증강 생성",
        note: "메모",
      });
      const glossaries = getMockTable<GlossaryRow>("glossaries");
      expect(glossaries[0].enabled).toBe(true);
    });

    it("loads seeded rows back into the store via loadGlossary", async () => {
      // seedTable exercises the read path directly: a parent glossaries row
      // plus N entries must hydrate the store after a user re-fetch.
      seedTable("glossaries", [
        {
          id: "seeded-glossary-id",
          user_id: "test-user-id",
          enabled: true,
          created_at: "2025-01-01T00:00:00.000Z",
        },
      ]);
      seedTable("glossary_entries", [
        {
          id: "seeded-entry-1",
          glossary_id: "seeded-glossary-id",
          source: "LLM",
          target: "대규모 언어 모델",
          note: null,
          created_at: "2025-01-01T00:00:00.000Z",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ]);
      // Toggling the user (null → seeded) forces `loadGlossary` to re-run
      // against the freshly seeded tables. The store-level cache is reset
      // implicitly by the user change.
      const { setMockUser, flushPromises } =
        await import("../../../tests/supabase-mock");
      setMockUser(null);
      setMockUser({ id: "test-user-id", email: "test@test.com" });
      await flushPromises();

      const value = get(glossaryStore);
      expect(value.enabled).toBe(true);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0]).toMatchObject({
        source: "LLM",
        target: "대규모 언어 모델",
      });
    });
  });
});
