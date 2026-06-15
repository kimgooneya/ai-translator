import type { Provider } from "$lib/schemas";

export const PRESET_PROVIDERS: readonly Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "preset",
    baseURL: "https://api.openai.com/v1",
    models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
    defaultModel: "gpt-5.4-mini",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "preset",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    models: ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"],
    defaultModel: "gemini-3.5-flash",
  },
  {
    id: "qwen",
    name: "Qwen (DashScope)",
    kind: "preset",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen3.7-max", "qwen3.7-plus", "qwen3.6-flash"],
    defaultModel: "qwen3.6-flash",
  },
  {
    id: "zhipu",
    name: "Zhipu Z.AI",
    kind: "preset",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-5.1", "glm-5", "glm-4.7", "glm-4.7-flash"],
    defaultModel: "glm-4.7-flash",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "preset",
    baseURL: "https://api.deepseek.com/v1",
    models: ["deepseek-v4-pro", "deepseek-v4-flash"],
    defaultModel: "deepseek-v4-flash",
  },
] as const;

export const PRESET_PROVIDER_IDS = PRESET_PROVIDERS.map((p) => p.id);

export function isPresetId(id: string): boolean {
  return PRESET_PROVIDER_IDS.includes(id);
}
