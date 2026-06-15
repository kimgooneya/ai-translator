export const DETECTION_HANGUL_THRESHOLD = 0.2; // 20% Hangul → 'ko'

export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "en"; // default for empty

  const chars = Array.from(text.replace(/\s/g, ""));
  if (chars.length === 0) return "en";

  const counts = {
    hangul: 0,
    kana: 0,
    cjk: 0,
    cyrillic: 0,
    arabic: 0,
    other: 0,
  };
  for (const ch of chars) {
    const code = ch.codePointAt(0)!;
    if (code >= 0xac00 && code <= 0xd7a3)
      counts.hangul++; // 가-힣
    else if (code >= 0x3040 && code <= 0x30ff)
      counts.kana++; // ぁ-ヿ (Hiragana+Katakana)
    else if (code >= 0x4e00 && code <= 0x9fff)
      counts.cjk++; // CJK Unified Ideographs
    else if (code >= 0x0400 && code <= 0x04ff) counts.cyrillic++;
    else if (code >= 0x0600 && code <= 0x06ff) counts.arabic++;
    else counts.other++;
  }

  const total = chars.length;
  const hangulRatio = counts.hangul / total;
  const kanaRatio = counts.kana / total;
  const cyrillicRatio = counts.cyrillic / total;
  const arabicRatio = counts.arabic / total;

  if (hangulRatio >= DETECTION_HANGUL_THRESHOLD) return "ko";
  if (kanaRatio > 0) return "ja"; // any kana → Japanese
  if (cyrillicRatio > 0.3) return "ru";
  if (arabicRatio > 0.3) return "ar";
  if (counts.cjk > 0 && counts.hangul === 0 && counts.kana === 0) return "zh"; // CJK without kana/hangul → Chinese
  return "en"; // default
}
