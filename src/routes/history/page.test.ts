import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import { get } from "svelte/store";
import { tick } from "svelte";
import type { TranslationHistoryEntry } from "$lib/schemas";
import {
  historyStore,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
} from "$lib/stores/history";
import Page from "./+page.svelte";

function entry(
  overrides: Partial<TranslationHistoryEntry> = {},
): TranslationHistoryEntry {
  return {
    id: "h-1",
    request: {
      sourceText: "hello world",
      sourceLang: "auto",
      targetLang: "ko",
      providerId: "openai",
      apiKey: "sk-test",
      model: "gpt-5.4-mini",
    },
    response: "안녕하세요 세계",
    providerName: "OpenAI",
    modelName: "gpt-5.4-mini",
    createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  };
}

function makeEntries(n: number): TranslationHistoryEntry[] {
  const out: TranslationHistoryEntry[] = [];
  for (let i = 0; i < n; i++) {
    out.push(
      entry({
        id: `h-${i}`,
        createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
      }),
    );
  }
  return out;
}

function getCardByEntryId(id: string): HTMLElement {
  const cards = screen.getAllByTestId("history-entry-card");
  return cards.find(
    (c) => c.getAttribute("data-entry-id") === id,
  ) as HTMLElement;
}

beforeEach(() => {
  historyStore.reset();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("History page", () => {
  describe("title & header", () => {
    it('renders the page heading "번역 기록"', () => {
      render(Page);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "번역 기록",
      );
    });

    it('renders the "전체 삭제" button', () => {
      render(Page);
      expect(screen.getByTestId("history-clear-all-button")).toHaveTextContent(
        "전체 삭제",
      );
    });

    it("renders the 100-entry limit notice at the bottom", () => {
      render(Page);
      const notice = screen.getByTestId("history-limit-notice");
      expect(notice.textContent ?? "").toContain("100개를 초과하면");
      expect(notice.textContent ?? "").toContain("자동 삭제");
    });
  });

  describe("empty state", () => {
    it("shows the empty message when there are no entries", () => {
      render(Page);
      const msg = screen.getByTestId("history-empty-message");
      expect(msg.textContent ?? "").toContain("번역 기록이 없습니다");
    });

    it("does not render the empty message once an entry exists", () => {
      addHistoryEntry(entry());
      render(Page);
      expect(screen.queryByTestId("history-empty-message")).toBeNull();
    });

    it("disables the clear-all button when empty", () => {
      render(Page);
      expect(screen.getByTestId("history-clear-all-button")).toBeDisabled();
    });

    it("enables the clear-all button when there is at least one entry", () => {
      addHistoryEntry(entry());
      render(Page);
      expect(screen.getByTestId("history-clear-all-button")).not.toBeDisabled();
    });
  });

  describe("entry list rendering", () => {
    it("renders a card for each entry in the store", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      addHistoryEntry(entry({ id: "h-3" }));
      render(Page);
      expect(screen.getAllByTestId("history-entry-card")).toHaveLength(3);
    });

    it("renders entries newest-first (prepend order)", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      addHistoryEntry(entry({ id: "h-3" }));
      render(Page);
      const cards = screen.getAllByTestId("history-entry-card");
      expect(cards.map((c) => c.getAttribute("data-entry-id"))).toEqual([
        "h-3",
        "h-2",
        "h-1",
      ]);
    });

    it("shows the provider name and model on each card", () => {
      addHistoryEntry(
        entry({
          id: "h-1",
          providerName: "DeepSeek",
          modelName: "deepseek-v4-flash",
        }),
      );
      render(Page);
      expect(screen.getByTestId("history-provider")).toHaveTextContent(
        "DeepSeek",
      );
      expect(screen.getByTestId("history-model")).toHaveTextContent(
        "deepseek-v4-flash",
      );
    });

    it("shows the source → target language pair", () => {
      addHistoryEntry(
        entry({
          id: "h-1",
          request: {
            sourceText: "hi",
            sourceLang: "en",
            targetLang: "ja",
            providerId: "openai",
            apiKey: "sk-test",
            model: "gpt-5.4-mini",
          },
        }),
      );
      render(Page);
      expect(screen.getByTestId("history-source-lang")).toHaveTextContent("en");
      expect(screen.getByTestId("history-target-lang")).toHaveTextContent("ja");
    });

    it("shows the formatted createdAt date on the card", () => {
      addHistoryEntry(
        entry({ id: "h-1", createdAt: "2025-06-14T09:30:00.000Z" }),
      );
      render(Page);
      const label = screen.getByTestId("history-created-at").textContent ?? "";
      // Korean formatting includes year, month, day, hour, minute.
      expect(label).toMatch(/2025/);
      expect(label).toMatch(/06/);
    });

    it("truncates sourceText preview to 50 chars + ellipsis when longer", () => {
      const long = "a".repeat(80);
      addHistoryEntry(
        entry({ id: "h-1", request: { ...entry().request, sourceText: long } }),
      );
      render(Page);
      const preview =
        screen.getByTestId("history-source-preview").textContent ?? "";
      expect(preview.endsWith("...")).toBe(true);
      expect(preview.length).toBe(53); // 50 + 3
    });

    it("keeps the full sourceText when it is <= 50 chars (no ellipsis)", () => {
      const short = "short text";
      addHistoryEntry(
        entry({
          id: "h-1",
          request: { ...entry().request, sourceText: short },
        }),
      );
      render(Page);
      const preview =
        screen.getByTestId("history-source-preview").textContent ?? "";
      expect(preview).toBe(short);
      expect(preview.endsWith("...")).toBe(false);
    });

    it("truncates response preview to 50 chars + ellipsis when longer", () => {
      const long = "b".repeat(120);
      addHistoryEntry(entry({ id: "h-1", response: long }));
      render(Page);
      const preview =
        screen.getByTestId("history-response-preview").textContent ?? "";
      expect(preview.endsWith("...")).toBe(true);
      expect(preview.length).toBe(53);
    });

    it("renders the 자세히 and 삭제 buttons on each card", () => {
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);
      expect(screen.getByTestId("history-detail-button")).toHaveTextContent(
        "자세히",
      );
      expect(screen.getByTestId("history-delete-button")).toHaveTextContent(
        "삭제",
      );
    });
  });

  describe("detail panel", () => {
    it("does not render the panel initially", () => {
      render(Page);
      expect(screen.queryByTestId("history-detail-modal")).toBeNull();
    });

    it("opens the panel with full content when 자세히 is clicked", async () => {
      const longSource = "x".repeat(80);
      const longResponse = "y".repeat(80);
      addHistoryEntry(
        entry({
          id: "h-1",
          request: { ...entry().request, sourceText: longSource },
          response: longResponse,
        }),
      );
      render(Page);

      await fireEvent.click(screen.getByTestId("history-detail-button"));

      expect(screen.getByTestId("history-detail-modal")).toBeInTheDocument();
      // Full (untruncated) source and response are shown.
      expect(screen.getByTestId("history-detail-source")).toHaveTextContent(
        longSource,
      );
      expect(screen.getByTestId("history-detail-response")).toHaveTextContent(
        longResponse,
      );
    });

    it("shows customPrompt in the panel when present", async () => {
      addHistoryEntry(
        entry({
          id: "h-1",
          request: { ...entry().request, customPrompt: "비즈니스 격식체" },
        }),
      );
      render(Page);
      await fireEvent.click(screen.getByTestId("history-detail-button"));
      expect(
        screen.getByTestId("history-detail-custom-prompt"),
      ).toHaveTextContent("비즈니스 격식체");
    });

    it("does not render the customPrompt section when absent", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);
      await fireEvent.click(screen.getByTestId("history-detail-button"));
      expect(screen.queryByTestId("history-detail-custom-prompt")).toBeNull();
    });

    it("shows glossary usage info in the panel when present", async () => {
      addHistoryEntry(
        entry({
          id: "h-1",
          request: {
            ...entry().request,
            glossary: {
              enabled: true,
              entries: [
                { id: "g1", source: "RAG", target: "검색 증강 생성" },
                { id: "g2", source: "LLM", target: "대규모 언어 모델" },
              ],
            },
          },
        }),
      );
      render(Page);
      await fireEvent.click(screen.getByTestId("history-detail-button"));
      const gloss = screen.getByTestId("history-detail-glossary");
      expect(gloss.textContent ?? "").toContain("사용");
      expect(gloss.textContent ?? "").toContain("2개");
    });

    it("shows tokensUsed in the panel when present", async () => {
      addHistoryEntry(entry({ id: "h-1", tokensUsed: 128 }));
      render(Page);
      await fireEvent.click(screen.getByTestId("history-detail-button"));
      expect(
        screen.getByTestId("history-detail-tokens").textContent ?? "",
      ).toContain("128");
    });

    it("closes the panel when the close button is clicked", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);
      await fireEvent.click(screen.getByTestId("history-detail-button"));
      expect(screen.getByTestId("history-detail-modal")).toBeInTheDocument();

      await fireEvent.click(screen.getByTestId("history-detail-close"));
      expect(screen.queryByTestId("history-detail-modal")).toBeNull();
    });
  });

  describe("single entry delete", () => {
    it("removes the entry when the card 삭제 button is clicked", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);
      expect(screen.getAllByTestId("history-entry-card")).toHaveLength(1);

      await fireEvent.click(screen.getByTestId("history-delete-button"));

      expect(screen.queryAllByTestId("history-entry-card")).toHaveLength(0);
      expect(get(historyStore)).toHaveLength(0);
    });

    it("removes only the targeted entry, leaving others untouched", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      render(Page);

      const card = getCardByEntryId("h-1");
      await fireEvent.click(within(card).getByTestId("history-delete-button"));

      expect(screen.queryAllByTestId("history-entry-card")).toHaveLength(1);
      expect(get(historyStore).map((e) => e.id)).toEqual(["h-2"]);
    });

    it("does not show a confirm dialog for single-entry delete (immediate)", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-delete-button"));
      expect(confirmSpy).not.toHaveBeenCalled();
    });
  });

  describe("clear all", () => {
    it("does NOT clear when confirm() returns false", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-clear-all-button"));

      expect(get(historyStore)).toHaveLength(2);
      expect(screen.getAllByTestId("history-entry-card")).toHaveLength(2);
    });

    it("clears all entries when confirm() returns true", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-clear-all-button"));

      expect(get(historyStore)).toEqual([]);
      expect(screen.queryAllByTestId("history-entry-card")).toHaveLength(0);
    });

    it("passes the Korean confirm message to window.confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-clear-all-button"));

      expect(confirmSpy).toHaveBeenCalledWith("모든 기록을 삭제하시겠습니까?");
    });

    it("shows the empty message after clearing", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-clear-all-button"));

      expect(screen.getByTestId("history-empty-message")).toBeInTheDocument();
    });

    it("persists empty array to localStorage after clearing", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("history-clear-all-button"));

      const raw = localStorage.getItem("translator.history");
      expect(JSON.parse(raw ?? "[]")).toEqual([]);
    });
  });

  describe("store integration", () => {
    it("reflects entries added directly to the store via addHistoryEntry", () => {
      addHistoryEntry(entry({ id: "direct-1", response: "직접 추가" }));
      render(Page);
      expect(screen.getByTestId("history-response-preview")).toHaveTextContent(
        "직접 추가",
      );
    });

    it("reflects removeHistoryEntry applied directly to the store", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      render(Page);
      expect(screen.getAllByTestId("history-entry-card")).toHaveLength(1);

      removeHistoryEntry("h-1");
      await tick();

      expect(screen.queryAllByTestId("history-entry-card")).toHaveLength(0);
      expect(screen.getByTestId("history-empty-message")).toBeInTheDocument();
    });

    it("reflects clearHistory applied directly to the store", async () => {
      addHistoryEntry(entry({ id: "h-1" }));
      addHistoryEntry(entry({ id: "h-2" }));
      render(Page);

      clearHistory();
      await tick();

      expect(screen.queryAllByTestId("history-entry-card")).toHaveLength(0);
      expect(screen.getByTestId("history-empty-message")).toBeInTheDocument();
    });

    it("reflects external 100-entry trimming via the store", async () => {
      for (const e of makeEntries(101)) {
        addHistoryEntry(e);
      }
      render(Page);
      expect(screen.getAllByTestId("history-entry-card")).toHaveLength(100);
      expect(get(historyStore).map((e) => e.id)).not.toContain("h-0");
    });
  });
});
