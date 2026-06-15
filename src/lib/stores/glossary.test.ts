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

function entry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: "g-1",
    source: "RAG",
    target: "검색 증강 생성",
    ...overrides,
  };
}

beforeEach(() => {
  glossaryStore.reset();
  localStorage.clear();
});

describe("glossaryStore", () => {
  describe("initial state", () => {
    it("starts with enabled=false and an empty entries array", () => {
      const value = get(glossaryStore);
      expect(value).toEqual({ enabled: false, entries: [] });
    });
  });

  describe("addEntry", () => {
    it("appends a new entry to the entries array", () => {
      addEntry(entry());
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0]).toMatchObject({
        source: "RAG",
        target: "검색 증강 생성",
      });
    });

    it("does not mutate or replace existing entries", () => {
      addEntry(entry({ id: "g-1", source: "A" }));
      addEntry(entry({ id: "g-2", source: "B" }));
      const value = get(glossaryStore);
      expect(value.entries.map((e) => e.source)).toEqual(["A", "B"]);
    });

    it("persists the new entry to localStorage", () => {
      addEntry(entry({ id: "persist-1" }));
      const raw = localStorage.getItem("translator.glossary");
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0].id).toBe("persist-1");
    });

    it("accepts an entry with an optional note", () => {
      addEntry(entry({ note: "전문 용어" }));
      const value = get(glossaryStore);
      expect(value.entries[0].note).toBe("전문 용어");
    });
  });

  describe("updateEntry", () => {
    it("patches the matching entry by id", () => {
      addEntry(entry({ id: "g-1", source: "old", target: "옛날" }));
      updateEntry("g-1", { source: "new" });
      const value = get(glossaryStore);
      expect(value.entries[0]).toMatchObject({ source: "new", target: "옛날" });
    });

    it("preserves fields that are not in the patch", () => {
      addEntry(entry({ id: "g-1", source: "s", target: "t", note: "n" }));
      updateEntry("g-1", { target: "t2" });
      const value = get(glossaryStore);
      expect(value.entries[0]).toMatchObject({
        source: "s",
        target: "t2",
        note: "n",
      });
    });

    it("is a no-op when the id does not exist", () => {
      addEntry(entry({ id: "g-1" }));
      updateEntry("g-missing", { source: "x" });
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0].source).toBe("RAG");
    });

    it("updates only the targeted entry when multiple exist", () => {
      addEntry(entry({ id: "g-1", source: "A" }));
      addEntry(entry({ id: "g-2", source: "B" }));
      updateEntry("g-2", { source: "B2" });
      const value = get(glossaryStore);
      expect(value.entries.map((e) => e.source)).toEqual(["A", "B2"]);
    });
  });

  describe("removeEntry", () => {
    it("removes the entry with the given id", () => {
      addEntry(entry({ id: "g-1" }));
      removeEntry("g-1");
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(0);
    });

    it("leaves other entries untouched", () => {
      addEntry(entry({ id: "g-1" }));
      addEntry(entry({ id: "g-2" }));
      removeEntry("g-1");
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
      expect(value.entries[0].id).toBe("g-2");
    });

    it("is a no-op when the id does not exist", () => {
      addEntry(entry({ id: "g-1" }));
      removeEntry("g-missing");
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
    });
  });

  describe("toggleEnabled", () => {
    it("flips enabled from false to true", () => {
      expect(get(glossaryStore).enabled).toBe(false);
      toggleEnabled();
      expect(get(glossaryStore).enabled).toBe(true);
    });

    it("flips enabled from true back to false", () => {
      toggleEnabled();
      toggleEnabled();
      expect(get(glossaryStore).enabled).toBe(false);
    });

    it("does not touch the entries array", () => {
      addEntry(entry({ id: "g-1" }));
      toggleEnabled();
      const value = get(glossaryStore);
      expect(value.entries).toHaveLength(1);
    });

    it("persists the enabled flag to localStorage", () => {
      toggleEnabled();
      const raw = localStorage.getItem("translator.glossary");
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.enabled).toBe(true);
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
    it("survives a load/parse round-trip after mutations", () => {
      addEntry(
        entry({
          id: "g-1",
          source: "RAG",
          target: "검색 증강 생성",
          note: "메모",
        }),
      );
      toggleEnabled();
      // Force a fresh load by clearing and reading — the persisted value must parse.
      const raw = localStorage.getItem("translator.glossary");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed).toEqual({
        enabled: true,
        entries: [
          { id: "g-1", source: "RAG", target: "검색 증강 생성", note: "메모" },
        ],
      });
    });
  });
});
