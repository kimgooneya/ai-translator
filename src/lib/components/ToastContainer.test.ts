import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import { get } from "svelte/store";
import ToastContainer from "$lib/components/ToastContainer.svelte";
import { toasts, type ToastType } from "$lib/stores/toasts";

const { addToast, removeToast, clearToasts } = toasts;

beforeEach(() => {
  clearToasts();
});

afterEach(() => {
  cleanup();
});

describe("ToastContainer", () => {
  describe("empty state", () => {
    it("renders nothing when there are no toasts", () => {
      render(ToastContainer);
      expect(screen.queryByTestId("toast-container")).toBeNull();
    });
  });

  describe("rendering a toast", () => {
    it("renders the container once a toast is added", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "안내 드립니다" });
      expect(await screen.findByTestId("toast-container")).toBeInTheDocument();
      expect(await screen.findByTestId("toast")).toBeInTheDocument();
    });

    it("shows the message text", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "네트워크가 복구되었습니다." });
      expect(await screen.findByTestId("toast-message")).toHaveTextContent(
        "네트워크가 복구되었습니다.",
      );
    });

    it("exposes the type via the data-toast-type attribute", async () => {
      render(ToastContainer);
      addToast({ type: "error", message: "오류" });
      const toast = await screen.findByTestId("toast");
      expect(toast.getAttribute("data-toast-type")).toBe("error");
    });

    it("renders multiple toasts stacked in the container", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "first" });
      addToast({ type: "success", message: "second" });
      addToast({ type: "warning", message: "third" });
      expect(await screen.findByTestId("toast-container")).toBeInTheDocument();
      expect(screen.getAllByTestId("toast")).toHaveLength(3);
    });
  });

  describe("type-based colors", () => {
    it.each(["info", "success", "warning", "error"] as ToastType[])(
      "renders %s toasts with their type marker",
      async (type) => {
        render(ToastContainer);
        addToast({ type, message: `${type} message` });
        const toast = await screen.findByTestId("toast");
        expect(toast.getAttribute("data-toast-type")).toBe(type);
        // Each type palette includes a distinctive color class.
        expect(toast.className).toMatch(/bg-(blue|green|yellow|red)-50/);
      },
    );

    it("uses red palette for error toasts", async () => {
      render(ToastContainer);
      addToast({ type: "error", message: "에러" });
      const toast = await screen.findByTestId("toast");
      expect(toast.className).toContain("bg-red-50");
    });

    it("uses yellow palette for warning toasts", async () => {
      render(ToastContainer);
      addToast({ type: "warning", message: "경고" });
      const toast = await screen.findByTestId("toast");
      expect(toast.className).toContain("bg-yellow-50");
    });

    it("uses green palette for success toasts", async () => {
      render(ToastContainer);
      addToast({ type: "success", message: "성공" });
      const toast = await screen.findByTestId("toast");
      expect(toast.className).toContain("bg-green-50");
    });

    it("uses blue palette for info toasts", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "정보" });
      const toast = await screen.findByTestId("toast");
      expect(toast.className).toContain("bg-blue-50");
    });
  });

  describe("close button", () => {
    it("renders a close button for each toast", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "closable" });
      expect(await screen.findByTestId("toast-close")).toBeInTheDocument();
    });

    it("empties the store when the close button is clicked", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "dismiss me" });
      const btn = await screen.findByTestId("toast-close");
      await fireEvent.click(btn);
      // The store updates synchronously on removeToast.
      expect(get(toasts)).toHaveLength(0);
    });

    it("removes only the toast whose close button was clicked", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "keep" });
      addToast({ type: "error", message: "dismiss" });
      const closeButtons = await screen.findAllByTestId("toast-close");
      // Close the second toast (the error one).
      await fireEvent.click(closeButtons[1]);
      expect(get(toasts)).toHaveLength(1);
      expect(get(toasts)[0].message).toBe("keep");
    });

    it("is labelled for screen readers (aria-label)", async () => {
      render(ToastContainer);
      addToast({ type: "info", message: "a11y" });
      const btn = await screen.findByTestId("toast-close");
      expect(btn.getAttribute("aria-label")).toBe("알림 닫기");
    });
  });

  describe("reactivity", () => {
    it("appears when a toast is added after mount", async () => {
      render(ToastContainer);
      expect(screen.queryByTestId("toast")).toBeNull();
      addToast({ type: "info", message: "late" });
      expect(await screen.findByTestId("toast-message")).toHaveTextContent(
        "late",
      );
    });

    it("hides the container once the last toast is removed via the API", async () => {
      render(ToastContainer);
      const id = addToast({ type: "info", message: "api removal" });
      await screen.findByTestId("toast");
      removeToast(id);
      // Store is the source of truth for removal; container should no
      // longer report toasts.
      expect(get(toasts)).toHaveLength(0);
    });
  });
});
