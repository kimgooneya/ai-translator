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
import type { TranslationHistoryRow } from "$lib/supabase/database.types";
import { getMockTable, resetMockSupabase } from "../../../tests/supabase-mock";

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

// The mock tables are reset between tests by setup.ts afterEach; the store
// also needs an explicit reset because it doesn't auto-refetch when the user
// (and therefore the userStore value) is unchanged across tests.
beforeEach(() => {
  resetMockSupabase();
  historyStore.set([]);
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
    it("prepends a new entry (newest first)", async () => {
      await addHistoryEntry(
        entry({ id: "h-1", createdAt: "2025-01-01T00:00:00.000Z" }),
      );
      await addHistoryEntry(
        entry({ id: "h-2", createdAt: "2025-01-02T00:00:00.000Z" }),
      );
      const value = get(historyStore);
      expect(value.map((e) => e.createdAt)).toEqual([
        "2025-01-02T00:00:00.000Z",
        "2025-01-01T00:00:00.000Z",
      ]);
    });

    it("persists the new entry to the translation_history table", async () => {
      await addHistoryEntry(entry({ id: "persist-1", response: "안녕" }));
      const rows = getMockTable<TranslationHistoryRow>("translation_history");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        response: "안녕",
        provider_name: "OpenAI",
        model_name: "gpt-5.4-mini",
        user_id: "test-user-id",
      });
    });

    it("accepts an entry with optional tokensUsed", async () => {
      await addHistoryEntry(entry({ tokensUsed: 42 }));
      expect(get(historyStore)[0].tokensUsed).toBe(42);
    });

    it("accepts an entry with glossary and customPrompt", async () => {
      await addHistoryEntry(
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
    it("keeps length at 100 after adding 101 entries", async () => {
      for (let i = 0; i < 101; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      expect(get(historyStore)).toHaveLength(100);
    });

    it("drops the oldest entry (the first added) when 101 are inserted", async () => {
      for (let i = 0; i < 101; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      const timestamps = get(historyStore).map((e) => e.createdAt);
      const oldest = new Date(2025, 0, 1, 0, 0, 0).toISOString();
      const newest = new Date(2025, 0, 1, 0, 0, 100).toISOString();
      const second = new Date(2025, 0, 1, 0, 0, 1).toISOString();
      // h-0 was added first (oldest). It should be gone.
      expect(timestamps).not.toContain(oldest);
      // The newest (h-100) and h-1 should remain.
      expect(timestamps).toContain(newest);
      expect(timestamps).toContain(second);
    });

    it("keeps exactly HISTORY_LIMIT (100) entries, not more", async () => {
      for (let i = 0; i < 150; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      expect(get(historyStore).length).toBe(HISTORY_LIMIT);
    });

    it("keeps the 100 newest entries when overflow occurs", async () => {
      for (let i = 0; i < 150; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      const timestamps = get(historyStore).map((e) => e.createdAt);
      // Newest 100 = h-149 .. h-50 (prepended order: newest first).
      expect(timestamps[0]).toBe(new Date(2025, 0, 1, 0, 0, 149).toISOString());
      expect(timestamps[99]).toBe(new Date(2025, 0, 1, 0, 0, 50).toISOString());
      expect(timestamps).not.toContain(
        new Date(2025, 0, 1, 0, 0, 49).toISOString(),
      );
    });

    it("does not trim when exactly 100 entries are added", async () => {
      for (let i = 0; i < 100; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      expect(get(historyStore)).toHaveLength(100);
    });

    it("trims one entry when going from 100 to 101", async () => {
      for (let i = 0; i < 100; i++) {
        await addHistoryEntry(
          entry({
            id: `h-${i}`,
            createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
          }),
        );
      }
      expect(get(historyStore)).toHaveLength(100);
      await addHistoryEntry(
        entry({
          id: "h-100",
          createdAt: new Date(2025, 0, 1, 0, 0, 100).toISOString(),
        }),
      );
      expect(get(historyStore)).toHaveLength(100);
      const timestamps = get(historyStore).map((e) => e.createdAt);
      expect(timestamps).not.toContain(
        new Date(2025, 0, 1, 0, 0, 0).toISOString(),
      );
    });
  });

  describe("removeHistoryEntry", () => {
    it("removes the entry with the given id", async () => {
      const e = entry({ id: "h-1", response: "안녕" });
      await addHistoryEntry(e);
      const persistedId = get(historyStore)[0].id;
      await removeHistoryEntry(persistedId);
      expect(get(historyStore)).toHaveLength(0);
    });

    it("leaves other entries untouched", async () => {
      await addHistoryEntry(
        entry({
          id: "h-1",
          response: "a",
          createdAt: "2025-01-01T00:00:00.000Z",
        }),
      );
      await addHistoryEntry(
        entry({
          id: "h-2",
          response: "b",
          createdAt: "2025-01-02T00:00:00.000Z",
        }),
      );
      const entries = get(historyStore);
      const oldestId = entries.find((e) => e.response === "a")!.id;
      await removeHistoryEntry(oldestId);
      const value = get(historyStore);
      expect(value).toHaveLength(1);
      expect(value[0].response).toBe("b");
    });

    it("is a no-op when the id does not exist", async () => {
      await addHistoryEntry(entry({ id: "h-1" }));
      await removeHistoryEntry("h-missing");
      expect(get(historyStore)).toHaveLength(1);
    });
  });

  describe("clearHistory", () => {
    it("empties the store", async () => {
      await addHistoryEntry(entry({ id: "h-1" }));
      await addHistoryEntry(entry({ id: "h-2" }));
      await clearHistory();
      expect(get(historyStore)).toEqual([]);
    });

    it("removes all rows from the translation_history table", async () => {
      await addHistoryEntry(entry({ id: "h-1" }));
      await clearHistory();
      const rows = getMockTable<TranslationHistoryRow>("translation_history");
      expect(rows).toEqual([]);
    });

    it("is safe to call on an empty store", async () => {
      await clearHistory();
      expect(get(historyStore)).toEqual([]);
    });
  });

  describe("schema compliance", () => {
    it("round-trips request/response/provider/model through the table", async () => {
      await addHistoryEntry(
        entry({ id: "h-1", response: "안녕", tokensUsed: 7 }),
      );
      const rows = getMockTable<TranslationHistoryRow>("translation_history");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        response: "안녕",
        provider_name: "OpenAI",
        model_name: "gpt-5.4-mini",
        tokens_used: 7,
      });
      // Request jsonb round-trips with nested fields intact.
      expect(rows[0].request).toMatchObject({
        sourceText: "hello",
        targetLang: "ko",
      });
    });
  });
});
