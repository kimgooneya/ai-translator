import { describe, test, expect } from "vitest";
import { detectLanguage } from "./detectLanguage";

describe("detectLanguage", () => {
  // 'ko' detection: pure Hangul text → 'ko'
  test("detects pure Korean (Hangul) as ko", () => {
    expect(detectLanguage("안녕하세요 반갑습니다")).toBe("ko");
    expect(detectLanguage("가나다라마바사아자차카타파하")).toBe("ko");
  });

  // 'en' detection: pure ASCII text → 'en'
  test("detects pure ASCII as en", () => {
    expect(detectLanguage("Hello, how are you?")).toBe("en");
    expect(detectLanguage("This is English text")).toBe("en");
  });

  // 'ja' detection: text with Hiragana → 'ja'
  test("detects Japanese (Kana) as ja", () => {
    expect(detectLanguage("こんにちは")).toBe("ja");
    expect(detectLanguage("ありがとう")).toBe("ja");
  });

  // 'zh' detection: pure CJK ideographs (no kana, no hangul) → 'zh'
  test("detects Chinese (CJK) as zh", () => {
    expect(detectLanguage("你好世界")).toBe("zh");
    expect(detectLanguage("北京上海广州")).toBe("zh");
  });

  // 'ru' detection: Cyrillic text → 'ru'
  test("detects Russian (Cyrillic) as ru", () => {
    expect(detectLanguage("Привет, как дела?")).toBe("ru");
  });

  // 'ar' detection: Arabic text → 'ar'
  test("detects Arabic as ar", () => {
    expect(detectLanguage("مرحبا بك")).toBe("ar");
  });

  // Empty string → 'en' (default)
  test("returns en for empty string", () => {
    expect(detectLanguage("")).toBe("en");
  });

  // Whitespace-only → 'en'
  test("returns en for whitespace-only", () => {
    expect(detectLanguage("   ")).toBe("en");
  });

  // Boundary 19% Hangul → 'en' (below threshold)
  test("returns en when Hangul ratio is exactly 19%", () => {
    const hangulChars = "안녕"; // 2 chars
    const otherChars = "Hello world how are you doing"; // 22 chars
    const testText = hangulChars + otherChars;
    expect(detectLanguage(testText)).toBe("en");
  });

  // Boundary 20% Hangul → 'ko' (at threshold)
  test("returns ko when Hangul ratio is exactly 20%", () => {
    const hangulChars = "안녕하세요"; // 4 chars
    const otherChars = "Hello world"; // 11 chars
    const testText = hangulChars + otherChars;
    expect(detectLanguage(testText)).toBe("ko");
  });

  // Boundary 21% Hangul → 'ko' (above threshold)
  test("returns ko when Hangul ratio is 21%", () => {
    const hangulChars = "안녕하세요 반갑습니다"; // 8 chars
    const otherChars = "Hello world how are you doing today"; // 25 chars
    const testText = hangulChars + otherChars;
    expect(detectLanguage(testText)).toBe("ko");
  });

  // Mixed text (Hangul + English, ≥20% Hangul) → 'ko'
  test("returns ko for mixed text with Hangul >= 20%", () => {
    const testText = "안녕하세요 Hello world 반가워";
    expect(detectLanguage(testText)).toBe("ko");
  });

  // Mixed text (Hangul + English, <20% Hangul) → 'en'
  test("returns en for mixed text with Hangul < 20%", () => {
    const testText = "Hello 안녕 world";
    expect(detectLanguage(testText)).toBe("en");
  });

  // Numbers only → 'en'
  test("returns en for numbers only", () => {
    expect(detectLanguage("12345")).toBe("en");
    expect(detectLanguage("1 2 3 4 5")).toBe("en");
  });

  // Emoji only → 'en'
  test("returns en for emoji only", () => {
    expect(detectLanguage("😊👍🌟")).toBe("en");
  });

  // Mixed language detection priority
  test("prioritizes language based on detection rules", () => {
    // Japanese kana should take priority over Chinese CJK
    expect(detectLanguage("こんにちは世界")).toBe("ja");

    // Cyrillic below 30% threshold → 'en'
    expect(detectLanguage("Привет hello world how are you")).toBe("en");

    // Arabic below 30% threshold → 'en'
    expect(detectLanguage("مرحبا hello world how are you")).toBe("en");
  });
});
