import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import { get } from "svelte/store";
import { tick } from "svelte";
import type { GlossaryEntry } from "$lib/schemas";
import {
  glossaryStore,
  addEntry,
  updateEntry,
  removeEntry,
} from "$lib/stores/glossary";
import type { GlossaryEntryRow } from "$lib/supabase/database.types";
import { getMockTable } from "../../../../tests/supabase-mock";
import Page from "./+page.svelte";

function entry(overrides: Partial<GlossaryEntry> = {}): GlossaryEntry {
  return {
    id: "g-1",
    source: "RAG",
    target: "검색 증강 생성",
    ...overrides,
  };
}

function getEditForm(): HTMLElement {
  const forms = screen.getAllByTestId("glossary-form");
  return forms.find(
    (f) => f.getAttribute("data-mode") === "edit",
  ) as HTMLElement;
}

beforeEach(() => {
  glossaryStore.set({ enabled: false, entries: [] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Glossary page", () => {
  describe("title & header", () => {
    it('renders the page heading "용어집"', () => {
      render(Page);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "용어집",
      );
    });

    it('renders the "용어집 사용" toggle label', () => {
      render(Page);
      expect(screen.getByText("용어집 사용")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows the empty message when there are no entries", () => {
      render(Page);
      expect(screen.getByTestId("glossary-empty-message")).toBeInTheDocument();
      expect(
        screen.getByTestId("glossary-empty-message").textContent ?? "",
      ).toContain("아직 용어가 없습니다");
    });

    it("does not render the empty message once an entry exists", async () => {
      await addEntry(entry());
      render(Page);
      expect(screen.queryByTestId("glossary-empty-message")).toBeNull();
    });
  });

  describe("entry count label", () => {
    it('shows "총 0개 용어" when empty', () => {
      render(Page);
      expect(screen.getByText("총 0개 용어")).toBeInTheDocument();
    });

    it('shows "총 1개 용어" after one entry is added', async () => {
      await addEntry(entry());
      render(Page);
      expect(screen.getByText("총 1개 용어")).toBeInTheDocument();
    });
  });

  describe("add flow", () => {
    it('renders the add form with data-mode="add"', () => {
      render(Page);
      const form = screen.getByTestId("glossary-form");
      expect(form.getAttribute("data-mode")).toBe("add");
    });

    it("adds an entry and renders a row when the form is submitted with valid data", async () => {
      render(Page);
      expect(screen.queryAllByTestId("glossary-entry-row")).toHaveLength(0);

      await fireEvent.input(screen.getByTestId("glossary-source-input"), {
        target: { value: "RAG" },
      });
      await fireEvent.input(screen.getByTestId("glossary-target-input"), {
        target: { value: "검색 증강 생성" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      expect(screen.getAllByTestId("glossary-entry-row")).toHaveLength(1);
      expect(screen.getByTestId("entry-source")).toHaveTextContent("RAG");
      expect(screen.getByTestId("entry-target")).toHaveTextContent(
        "검색 증강 생성",
      );
    });

    it("resets the add form after a successful submit", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("glossary-source-input"), {
        target: { value: "LLM" },
      });
      await fireEvent.input(screen.getByTestId("glossary-target-input"), {
        target: { value: "대규모 언어 모델" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      expect(
        (screen.getByTestId("glossary-source-input") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByTestId("glossary-target-input") as HTMLInputElement).value,
      ).toBe("");
    });

    it("includes the optional note in the row when provided", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("glossary-source-input"), {
        target: { value: "API" },
      });
      await fireEvent.input(screen.getByTestId("glossary-target-input"), {
        target: { value: "응용 프로그래밍 인터페이스" },
      });
      await fireEvent.input(screen.getByTestId("glossary-note-input"), {
        target: { value: "전문 용어" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      expect(screen.getByTestId("entry-note")).toHaveTextContent("전문 용어");
    });

    it("does NOT add a row when source is empty and shows a Korean error", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("glossary-target-input"), {
        target: { value: "대상" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      expect(screen.queryAllByTestId("glossary-entry-row")).toHaveLength(0);
      expect(screen.getByTestId("error-source")).toHaveTextContent(
        "원본 용어를 입력하세요.",
      );
    });

    it("does NOT add a row when target is empty and shows a Korean error", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("glossary-source-input"), {
        target: { value: "원본" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      expect(screen.queryAllByTestId("glossary-entry-row")).toHaveLength(0);
      expect(screen.getByTestId("error-target")).toHaveTextContent(
        "번역 용어를 입력하세요.",
      );
    });
  });

  describe("edit flow", () => {
    it("renders an edit form in place of the row when edit is clicked", async () => {
      await addEntry(
        entry({ id: "g-1", source: "RAG", target: "검색 증강 생성" }),
      );
      render(Page);

      await fireEvent.click(screen.getByTestId("edit-button"));

      const editForm = getEditForm();
      expect(editForm).toBeTruthy();
      expect(
        within(editForm).getByTestId("glossary-submit-button"),
      ).toHaveTextContent("수정");
    });

    it("prefills the edit form with the existing entry values", async () => {
      await addEntry(
        entry({ id: "g-1", source: "RAG", target: "검색 증강 생성" }),
      );
      render(Page);

      await fireEvent.click(screen.getByTestId("edit-button"));

      const editForm = getEditForm();
      expect(
        (
          within(editForm).getByTestId(
            "glossary-source-input",
          ) as HTMLInputElement
        ).value,
      ).toBe("RAG");
      expect(
        (
          within(editForm).getByTestId(
            "glossary-target-input",
          ) as HTMLInputElement
        ).value,
      ).toBe("검색 증강 생성");
    });

    it("updates the entry when the edit form is submitted", async () => {
      await addEntry(
        entry({ id: "g-1", source: "RAG", target: "검색 증강 생성" }),
      );
      render(Page);

      await fireEvent.click(screen.getByTestId("edit-button"));
      const editForm = getEditForm();
      await fireEvent.input(
        within(editForm).getByTestId("glossary-source-input"),
        {
          target: { value: "RAG2" },
        },
      );
      await fireEvent.click(
        within(editForm).getByTestId("glossary-submit-button"),
      );

      expect(get(glossaryStore).entries[0].source).toBe("RAG2");
      expect(screen.getByTestId("entry-source")).toHaveTextContent("RAG2");
    });

    it("returns to view mode (no edit form) when cancel is clicked", async () => {
      await addEntry(entry({ id: "g-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("edit-button"));
      expect(getEditForm()).toBeTruthy();

      await fireEvent.click(screen.getByTestId("glossary-cancel-button"));

      expect(
        screen
          .getAllByTestId("glossary-form")
          .some((f) => f.getAttribute("data-mode") === "edit"),
      ).toBe(false);
      expect(screen.getByTestId("glossary-entry-row")).toBeInTheDocument();
    });
  });

  describe("delete flow", () => {
    it("does NOT delete when confirm() returns false", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      await addEntry(entry({ id: "g-1" }));
      render(Page);

      expect(screen.getAllByTestId("glossary-entry-row")).toHaveLength(1);
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("glossary-entry-row")).toHaveLength(1);
    });

    it("removes the entry when confirm() returns true", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await addEntry(entry({ id: "g-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.queryAllByTestId("glossary-entry-row")).toHaveLength(0);
      expect(get(glossaryStore).entries).toHaveLength(0);
    });

    it("passes the Korean confirm message to window.confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      await addEntry(entry({ id: "g-1" }));
      render(Page);

      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
    });
  });

  describe("toggle flow", () => {
    it("renders an unchecked toggle when enabled is false", () => {
      render(Page);
      const toggle = screen.getByTestId("glossary-toggle") as HTMLInputElement;
      expect(toggle.checked).toBe(false);
    });

    it("flips enabled in the store when the toggle is clicked", async () => {
      render(Page);
      expect(get(glossaryStore).enabled).toBe(false);

      await fireEvent.click(screen.getByTestId("glossary-toggle"));

      expect(get(glossaryStore).enabled).toBe(true);
    });

    it("reflects a store-side enabled change on the checkbox", async () => {
      render(Page);
      const toggle = screen.getByTestId("glossary-toggle") as HTMLInputElement;
      expect(toggle.checked).toBe(false);

      glossaryStore.update((g) => ({ ...g, enabled: true }));
      await tick();

      expect(toggle.checked).toBe(true);
    });
  });

  describe("store integration", () => {
    it("persists an added entry to the glossary_entries table", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("glossary-source-input"), {
        target: { value: "Token" },
      });
      await fireEvent.input(screen.getByTestId("glossary-target-input"), {
        target: { value: "토큰" },
      });
      await fireEvent.click(screen.getByTestId("glossary-submit-button"));

      const rows = getMockTable<GlossaryEntryRow>("glossary_entries");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        source: "Token",
        target: "토큰",
      });
    });

    it("reflects entries added directly to the store via addEntry", async () => {
      await addEntry(
        entry({ id: "direct-1", source: "GPU", target: "그래픽 처리 장치" }),
      );
      render(Page);
      expect(screen.getByTestId("entry-source")).toHaveTextContent("GPU");
      expect(screen.getByText("총 1개 용어")).toBeInTheDocument();
    });

    it("reflects removeEntry applied directly to the store", async () => {
      await addEntry(entry({ id: "g-1" }));
      const persistedId = get(glossaryStore).entries[0].id;
      render(Page);
      expect(screen.getAllByTestId("glossary-entry-row")).toHaveLength(1);

      await removeEntry(persistedId);
      await tick();

      expect(screen.queryAllByTestId("glossary-entry-row")).toHaveLength(0);
      expect(screen.getByTestId("glossary-empty-message")).toBeInTheDocument();
    });

    it("reflects updateEntry applied directly to the store", async () => {
      await addEntry(entry({ id: "g-1", source: "old" }));
      const persistedId = get(glossaryStore).entries[0].id;
      render(Page);
      await updateEntry(persistedId, { source: "new" });
      await tick();
      expect(screen.getByTestId("entry-source")).toHaveTextContent("new");
    });
  });
});
