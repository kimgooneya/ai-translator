import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { get } from "svelte/store";
import { toasts, DEFAULT_TIMEOUT_MS, type ToastType } from "$lib/stores/toasts";

const { addToast, removeToast, clearToasts } = toasts;

beforeEach(() => {
  clearToasts();
});

describe("toasts store", () => {
  describe("initial state", () => {
    it("starts empty", () => {
      expect(get(toasts)).toEqual([]);
    });
  });

  describe("addToast", () => {
    it("adds a toast to the store", () => {
      addToast({ type: "info", message: "안녕" });
      const items = get(toasts);
      expect(items).toHaveLength(1);
      expect(items[0].message).toBe("안녕");
      expect(items[0].type).toBe("info");
    });

    it("returns a unique id for each toast", () => {
      const id1 = addToast({ type: "info", message: "a" });
      const id2 = addToast({ type: "info", message: "b" });
      expect(id1).not.toBe(id2);
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
    });

    it("assigns the returned id to the toast", () => {
      const id = addToast({ type: "info", message: "x" });
      expect(get(toasts)[0].id).toBe(id);
    });

    it('prefixes ids with "toast-"', () => {
      const id = addToast({ type: "info", message: "x" });
      expect(id.startsWith("toast-")).toBe(true);
    });

    it("keeps multiple toasts in insertion order", () => {
      addToast({ type: "info", message: "first" });
      addToast({ type: "success", message: "second" });
      addToast({ type: "error", message: "third" });
      const items = get(toasts);
      expect(items.map((t) => t.message)).toEqual(["first", "second", "third"]);
    });

    it.each(["info", "success", "warning"] as ToastType[])(
      "defaults timeoutMs to %ds for non-error types",
      (type) => {
        addToast({ type, message: "m" });
        expect(get(toasts)[0].timeoutMs).toBe(5000);
      },
    );

    it("defaults timeoutMs to 10s for error type", () => {
      addToast({ type: "error", message: "m" });
      expect(get(toasts)[0].timeoutMs).toBe(10000);
    });

    it("honors an explicit timeoutMs override", () => {
      addToast({ type: "error", message: "m", timeoutMs: 12345 });
      expect(get(toasts)[0].timeoutMs).toBe(12345);
    });
  });

  describe("auto-removal", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("removes the toast automatically after timeoutMs elapses", () => {
      addToast({ type: "info", message: "gone", timeoutMs: 1000 });
      expect(get(toasts)).toHaveLength(1);
      vi.advanceTimersByTime(999);
      expect(get(toasts)).toHaveLength(1);
      vi.advanceTimersByTime(2);
      expect(get(toasts)).toHaveLength(0);
    });

    it("does not remove a toast before its timeout elapses", () => {
      addToast({ type: "error", message: "lingers", timeoutMs: 10000 });
      vi.advanceTimersByTime(5000);
      expect(get(toasts)).toHaveLength(1);
    });

    it("removes only the expired toast, leaving siblings", () => {
      addToast({ type: "info", message: "short", timeoutMs: 1000 });
      addToast({ type: "info", message: "long", timeoutMs: 5000 });
      vi.advanceTimersByTime(1001);
      const items = get(toasts);
      expect(items).toHaveLength(1);
      expect(items[0].message).toBe("long");
    });
  });

  describe("removeToast", () => {
    it("removes the toast with the given id", () => {
      const id = addToast({ type: "info", message: "bye" });
      removeToast(id);
      expect(get(toasts)).toHaveLength(0);
    });

    it("removes only the matching toast", () => {
      const keepId = addToast({ type: "info", message: "keep" });
      const removeId = addToast({ type: "info", message: "remove" });
      removeToast(removeId);
      const items = get(toasts);
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(keepId);
    });

    it("is a no-op for an unknown id", () => {
      addToast({ type: "info", message: "stay" });
      removeToast("does-not-exist");
      expect(get(toasts)).toHaveLength(1);
    });
  });

  describe("clearToasts", () => {
    it("empties the store", () => {
      addToast({ type: "info", message: "a" });
      addToast({ type: "error", message: "b" });
      clearToasts();
      expect(get(toasts)).toEqual([]);
    });
  });

  describe("DEFAULT_TIMEOUT_MS", () => {
    it("exposes 5s for info/success/warning and 10s for error", () => {
      expect(DEFAULT_TIMEOUT_MS.info).toBe(5000);
      expect(DEFAULT_TIMEOUT_MS.success).toBe(5000);
      expect(DEFAULT_TIMEOUT_MS.warning).toBe(5000);
      expect(DEFAULT_TIMEOUT_MS.error).toBe(10000);
    });
  });
});
