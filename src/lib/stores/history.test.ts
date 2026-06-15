import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import {
  historyStore,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  HISTORY_LIMIT,
} from "$lib/stores/history";
import type { TranslationHistoryEntry } from "$lib/schemas";

function entry(
  overrides: Partial<TranslationHistoryEntry> = {},
): TranslationHistoryEntry {
  return {
    id: "h-1",
    request: {
      sourceText: "hello",
      sourceLang: "auto",
      targetLang: "ko",
      providerId: "openai",
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
    },
    response: "안녕하세요",
    providerName: "OpenAI",
    modelName: "gpt-5.4-mini",
    createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  historyStore.reset();
  localStorage.clear();
});

describe("historyStore", () => {
  describe("initial state", () => {
    it("starts with an empty array", () => {
      expect(get(historyStore)).toEqual([]);
    });
  });

  describe("HISTORY_LIMIT constant", () => {
    it("is 100", () => {
      expect(HISTORY_LIMIT).toBe(100);
    });
  });

  describe("addHistoryEntry", () => {
    it("prepends a new entry (newest first)", () => {
      addHistoryEntry(
        entry({ id: "h-1", createdAt: "2025-01-01T00:00:00.000Z" }),
      );
      addHistoryEntry(
        entry({ id: "h-2", createdAt: "2025-01-02T00:00:00.000Z" }),
      );
      const value = get(historyStore);
      expect(value.map((e) => e.id)).toEqual(["h-2", "h-1"]);
    });

    it("persists the new entry to localStorage under translator.history", () => {
      addHistoryEntry(entry({ id: "persist-1" }));
      const raw = localStorage.getItem("translator.history");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "[]");
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("persist-1");
    });

    it("accepts an entry with optional tokensUsed", () => {
      addHistoryEntry(entry({ tokensUsed: 42 }));
      expect(get(historyStore)[0].tokensUsed).toBe(42);
    });

    it("accepts an entry with glossary and customPrompt", () => {
      addHistoryEntry(
        entry({
          id: "h-rich",
          request: {
            sourceText: "RAG",
            sourceLang: "auto",
            targetLang: "ko",
            providerId: "openai",
            apiKey: "sk-test",
            model: "gpt-5.4-mini",
            customPrompt: "비즈니스 격식체",
            glossary: {
              enabled: true,
              entries: [{ id: "g1", source: "RAG", target: "검색 증강 생성" }],
            },
          },
        }),
      );
      const value = get(historyStore);
      expect(value[0].request.customPrompt).toBe("비즈니스 격식체");
      expect(value[0].request.glossary?.enabled).toBe(true);
    });
  });

  describe("100-entry limit (CRITICAL)", () => {
    it("keeps length at 100 after adding 101 entries", () => {
      for (let i = 0; i < 101; i++) {
        addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      expect(get(historyStore)).toHaveLength(100);
    });

    it("drops the oldest entry (the first added) when 101 are inserted", () => {
      for (let i = 0; i < 101; i++) {
        addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      const ids = get(historyStore).map((e) => e.id);
      // h-0 was added first (oldest). It should be gone.
      expect(ids).not.toContain("h-0");
      // The newest (h-100) and h-1 should remain.
      expect(ids).toContain("h-100");
      expect(ids).toContain("h-1");
    });

    it("keeps exactly HISTORY_LIMIT (100) entries, not more", () => {
      for (let i = 0; i < 150; i++) {
        addHistoryEntry(entry({ id: `h-${i}` }));
      }
      expect(get(historyStore).length).toBe(HISTORY_LIMIT);
    });

    it("keeps the 100 newest entries when overflow occurs", () => {
      for (let i = 0; i < 150; i++) {
        addHistoryEntry(entry({ id: `h-${i}` }));
      }
      const ids = get(historyStore).map((e) => e.id);
      // Newest 100 = h-149 .. h-50 (prepended order: newest first)
      expect(ids[0]).toBe("h-149");
      expect(ids[99]).toBe("h-50");
      expect(ids).not.toContain("h-49");
    });

    it("does not trim when exactly 100 entries are added", () => {
      for (let i = 0; i < 100; i++) {
        addHistoryEntry(entry({ id: `h-${i}` }));
      }
      expect(get(historyStore)).toHaveLength(100);
    });

    it("trims one entry when going from 100 to 101", () => {
      for (let i = 0; i < 100; i++) {
        addHistoryEntry(entry({ id: `h-${i}` }));
      }
      expect(get(historyStore)).toHaveLength(100);
      addHistoryEntry(entry({ id: "h-100" }));
      expect(get(historyStore)).toHaveLength(100);
      expect(get(historyStore).map((e) => e.id)).not.toContain("h-0");
    });
  });

  describe("removeHistoryEntry", () => {
    it("removes the entry with the given id", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      removeHistoryEntry("h-1");
      expect(get(historyStore)).toHaveLength(0);
    });

    it("leaves other entries untouched", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      removeHistoryEntry("h-1");
      const value = get(historyStore);
      expect(value).toHaveLength(1);
      expect(value[0].id).toBe("h-2");
    });

    it("is a no-op when the id does not exist", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      removeHistoryEntry("h-missing");
      expect(get(historyStore)).toHaveLength(1);
    });
  });

  describe("clearHistory", () => {
    it("empties the store", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      clearHistory();
      expect(get(historyStore)).toEqual([]);
    });

    it("persists an empty array to localStorage", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      clearHistory();
      const raw = localStorage.getItem("translator.history");
      expect(JSON.parse(raw ?? "[]")).toEqual([]);
    });

    it("is safe to call on an empty store", () => {
      clearHistory();
      expect(get(historyStore)).toEqual([]);
    });
  });

  describe("schema compliance", () => {
    it("survives a load/parse round-trip after mutations", () => {
      addHistoryEntry(entry({ id: "h-1", response: "안녕" }));
      const raw = localStorage.getItem("translator.history");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "[]");
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({ id: "h-1", response: "안녕" });
    });
  });
});
