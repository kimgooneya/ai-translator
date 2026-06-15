import { describe, it, expect } from "vitest";
import { UI } from "./ui-strings";

describe("UI strings", () => {
  it("APP_TITLE is Korean", () => {
    expect(UI.APP_TITLE).toBe("AI 번역기");
  });

  describe("NAV", () => {
    it("has all 4 navigation labels", () => {
      expect(UI.NAV.TRANSLATE).toBe("번역");
      expect(UI.NAV.SETTINGS).toBe("설정");
      expect(UI.NAV.GLOSSARY).toBe("용어집");
      expect(UI.NAV.HISTORY).toBe("기록");
    });
  });

  describe("TRANSLATE_PAGE", () => {
    it("has placeholder and button labels", () => {
      expect(UI.TRANSLATE_PAGE.PLACEHOLDER_SOURCE).toBeTruthy();
      expect(UI.TRANSLATE_PAGE.BUTTON_TRANSLATE).toBe("번역하기");
    });

    it("CHAR_COUNT formats number", () => {
      expect(UI.TRANSLATE_PAGE.CHAR_COUNT(42)).toBe("42자");
    });

    it("DETECTED_LANGUAGE formats name", () => {
      expect(UI.TRANSLATE_PAGE.DETECTED_LANGUAGE("한국어")).toBe(
        "감지: 한국어",
      );
    });
  });

  describe("ERRORS", () => {
    it("has all required error keys", () => {
      const required = [
        "NO_API_KEY",
        "INVALID_API_KEY",
        "RATE_LIMITED",
        "PROVIDER_ERROR",
        "STREAM_INTERRUPTED",
        "STORAGE_FULL",
      ];
      for (const key of required) {
        expect(UI.ERRORS[key as keyof typeof UI.ERRORS]).toBeTruthy();
      }
    });

    it("all error messages are Korean", () => {
      for (const value of Object.values(UI.ERRORS)) {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      }
    });
  });

  describe("HISTORY_PAGE", () => {
    it("CONFIRM_CLEAR is Korean question", () => {
      expect(UI.HISTORY_PAGE.CONFIRM_CLEAR).toContain("삭제");
    });

    it("CREATED_AT_FORMATTER returns a string for a Date", () => {
      const result = UI.HISTORY_PAGE.CREATED_AT_FORMATTER(
        new Date("2026-06-14T12:00:00Z"),
      );
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
