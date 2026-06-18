import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import {
  dismissedNoticesStore,
  dismissNotice,
  isNoticeDismissed,
} from "$lib/stores/notices";

beforeEach(() => {
  dismissedNoticesStore.reset();
  localStorage.clear();
});

describe("dismissedNoticesStore", () => {
  describe("initial state", () => {
    it("starts as an empty array on fresh load", () => {
      const value = get(dismissedNoticesStore);
      expect(value).toEqual([]);
    });
  });

  describe("dismissNotice", () => {
    it("adds an id to the store", () => {
      dismissNotice("settings.security-notice");
      const value = get(dismissedNoticesStore);
      expect(value).toEqual(["settings.security-notice"]);
    });

    it("does NOT duplicate an id when called twice", () => {
      dismissNotice("settings.security-notice");
      dismissNotice("settings.security-notice");
      const value = get(dismissedNoticesStore);
      expect(value).toEqual(["settings.security-notice"]);
    });

    it("keeps multiple distinct ids in insertion order", () => {
      dismissNotice("a");
      dismissNotice("b");
      const value = get(dismissedNoticesStore);
      expect(value).toEqual(["a", "b"]);
    });

    it("persists the dismissed id to localStorage", () => {
      dismissNotice("settings.security-notice");
      const raw = localStorage.getItem("translator.dismissedNotices");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "[]");
      expect(parsed).toEqual(["settings.security-notice"]);
    });
  });

  describe("isNoticeDismissed", () => {
    it("returns false before an id is dismissed", () => {
      expect(isNoticeDismissed("settings.security-notice")).toBe(false);
    });

    it("returns true after an id is dismissed", () => {
      dismissNotice("settings.security-notice");
      expect(isNoticeDismissed("settings.security-notice")).toBe(true);
    });

    it("does not flag unrelated ids", () => {
      dismissNotice("a");
      expect(isNoticeDismissed("b")).toBe(false);
    });
  });
});
