export interface Language {
  code: string;
  name: string;
}

export const AUTO_LANGUAGE: Language = {
  code: "auto",
  name: "자동 감지",
};

export const LANGUAGES: readonly Language[] = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "영어" },
  { code: "ja", name: "일본어" },
  { code: "zh", name: "중국어 (간체)" },
  { code: "zh-TW", name: "중국어 (번체)" },
  { code: "es", name: "스페인어" },
  { code: "fr", name: "프랑스어" },
  { code: "de", name: "독일어" },
  { code: "it", name: "이탈리아어" },
  { code: "pt", name: "포르투갈어" },
  { code: "ru", name: "러시아어" },
  { code: "hi", name: "힌디어" },
  { code: "vi", name: "베트남어" },
  { code: "th", name: "태국어" },
  { code: "id", name: "인도네시아어" },
] as const;

export function findLanguage(code: string): Language | undefined {
  if (code === "auto") return AUTO_LANGUAGE;
  return LANGUAGES.find((l) => l.code === code);
}

export function languageName(code: string): string {
  return findLanguage(code)?.name ?? code;
}
