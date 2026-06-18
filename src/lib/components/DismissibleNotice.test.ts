import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import DismissibleNotice from "./DismissibleNotice.svelte";
import { dismissedNoticesStore } from "$lib/stores/notices";

const NOTICE_ID = "test.notice";
const MESSAGE = "This is a dismissible notice";

beforeEach(() => {
  dismissedNoticesStore.reset();
  localStorage.clear();
});

describe("DismissibleNotice", () => {
  describe("rendering", () => {
    it("renders the message text when not dismissed", () => {
      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
      });
      expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    });

    it("applies data-testid when provided", () => {
      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
        testId: "my-notice",
      });
      expect(screen.getByTestId("my-notice")).toBeInTheDocument();
    });
  });

  describe("dismissing", () => {
    it("does NOT render after the close button is clicked", async () => {
      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
        testId: "my-notice",
      });
      expect(screen.getByText(MESSAGE)).toBeInTheDocument();

      await fireEvent.click(screen.getByRole("button"));

      expect(screen.queryByTestId("my-notice")).toBeNull();
      expect(screen.queryByText(MESSAGE)).toBeNull();
    });

    it("persists the dismissal to localStorage under translator.dismissedNotices", async () => {
      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
      });
      await fireEvent.click(screen.getByRole("button"));

      const raw = localStorage.getItem("translator.dismissedNotices");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "[]");
      expect(parsed).toContain(NOTICE_ID);
    });
  });

  describe("pre-dismissed state", () => {
    it("does NOT render if the notice id is already dismissed in localStorage", () => {
      // The store is a module-load singleton, so pre-seed both localStorage
      // (what a returning user would have on disk) and the live store (what
      // persistedWritable would have loaded from that disk at module import).
      localStorage.setItem(
        "translator.dismissedNotices",
        JSON.stringify([NOTICE_ID]),
      );
      dismissedNoticesStore.set([NOTICE_ID]);

      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
        testId: "my-notice",
      });

      expect(screen.queryByTestId("my-notice")).toBeNull();
      expect(screen.queryByText(MESSAGE)).toBeNull();
    });
  });

  describe("accessibility", () => {
    it("gives the close button an aria-label equal to the localized 닫기", () => {
      render(DismissibleNotice, {
        id: NOTICE_ID,
        message: MESSAGE,
        variant: "yellow",
      });
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-label")).toBe("닫기");
    });
  });
});
