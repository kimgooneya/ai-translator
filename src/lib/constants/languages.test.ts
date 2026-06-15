import { describe, it, expect } from "vitest";
import {
  LANGUAGES,
  AUTO_LANGUAGE,
  findLanguage,
  languageName,
} from "./languages";

describe("languages constants", () => {
  it('AUTO_LANGUAGE has code "auto"', () => {
    expect(AUTO_LANGUAGE.code).toBe("auto");
    expect(AUTO_LANGUAGE.name).toBe("자동 감지");
  });

  it("includes the core 4 languages (ko, en, ja, zh)", () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes).toContain("ko");
    expect(codes).toContain("en");
    expect(codes).toContain("ja");
    expect(codes).toContain("zh");
  });

  it("has at least 20 languages", () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(20);
  });

  it("all entries have non-empty code and name", () => {
    for (const lang of LANGUAGES) {
      expect(lang.code.length).toBeGreaterThan(0);
      expect(lang.name.length).toBeGreaterThan(0);
    }
  });

  it("codes are unique", () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("korean language has correct name", () => {
    const ko = LANGUAGES.find((l) => l.code === "ko");
    expect(ko?.name).toBe("한국어");
  });
});

describe("findLanguage", () => {
  it('returns AUTO_LANGUAGE for "auto"', () => {
    expect(findLanguage("auto")).toEqual(AUTO_LANGUAGE);
  });

  it("returns the matching language for known code", () => {
    expect(findLanguage("en")?.name).toBe("영어");
  });

  it("returns undefined for unknown code", () => {
    expect(findLanguage("xyz")).toBeUndefined();
  });
});

describe("languageName", () => {
  it("returns the name for known code", () => {
    expect(languageName("ko")).toBe("한국어");
  });

  it('returns "자동 감지" for auto', () => {
    expect(languageName("auto")).toBe("자동 감지");
  });

  it("returns the code itself for unknown", () => {
    expect(languageName("xyz")).toBe("xyz");
  });
});
