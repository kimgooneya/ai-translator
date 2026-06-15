import { z } from "zod";

export const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["preset", "custom"]),
  baseURL: z.url(),
  models: z.array(z.string().min(1)).min(1),
  defaultModel: z.string(),
});

export const providerConfigSchema = z.object({
  providerId: z.string().min(1),
  apiKey: z.string(),
  selectedModel: z.string().min(1),
  // Optional for preset providers (baseURL looked up from registry);
  // required for custom providers at validation time.
  baseURL: z.url().optional(),
  params: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
});

export const settingsSchema = z.object({
  providers: z.array(providerConfigSchema),
  activeProviderId: z.string().nullable(),
  defaultTargetLang: z.string().default("ko"),
  customPrompt: z.string().optional(),
});

export const glossaryEntrySchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  note: z.string().optional(),
});

export const glossarySchema = z.object({
  enabled: z.boolean().default(false),
  entries: z.array(glossaryEntrySchema).default([]),
});

export const translationRequestSchema = z.object({
  sourceText: z.string().min(1),
  sourceLang: z.union([z.literal("auto"), z.string().min(2)]),
  targetLang: z.string().min(2),
  providerId: z.string().min(1),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  glossary: glossarySchema.optional(),
  customPrompt: z.string().optional(),
});

export const translationHistoryEntrySchema = z.object({
  id: z.string().min(1),
  request: translationRequestSchema,
  response: z.string(),
  providerName: z.string(),
  modelName: z.string(),
  createdAt: z.string(),
  tokensUsed: z.number().int().nonnegative().optional(),
});

export type Provider = z.infer<typeof providerSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type Glossary = z.infer<typeof glossarySchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationHistoryEntry = z.infer<
  typeof translationHistoryEntrySchema
>;
