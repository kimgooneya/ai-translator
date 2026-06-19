import { z } from "zod";

/**
 * Provider catalog entry (admin-managed preset). Sourced from the
 * `provider_presets` table and surfaced to the client via
 * `GET /api/user/providers`. Carries NO key material — keys live in the
 * separate `provider_keys` table and are never exposed to the browser.
 */
export const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["preset", "custom"]),
  baseURL: z.url(),
  models: z.array(z.string().min(1)).min(1),
  defaultModel: z.string(),
});

/**
 * Per-user provider selection stored in localStorage. Managed-key model:
 * the client only remembers which provider is selected and which model the
 * user last picked for it. The API key is NO LONGER stored client-side —
 * the server resolves an encrypted key from `provider_keys` per request.
 */
export const providerConfigSchema = z.object({
  providerId: z.string().min(1),
  selectedModel: z.string().min(1),
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

/**
 * Translation request body for `POST /api/translate`.
 *
 * NOTE (managed-key migration): `apiKey` was REMOVED. The server now resolves
 * an encrypted key from `provider_keys` based on the authenticated session
 * + `providerId`. The client must NOT send a key.
 */
export const translationRequestSchema = z.object({
  sourceText: z.string().min(1),
  sourceLang: z.union([z.literal("auto"), z.string().min(2)]),
  targetLang: z.string().min(2),
  providerId: z.string().min(1),
  model: z.string().min(1),
  glossary: glossarySchema.optional(),
  customPrompt: z.string().optional(),
  cleanSourceText: z.boolean().optional(),
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

export const dismissedNoticesSchema = z.array(z.string().min(1));

export type Provider = z.infer<typeof providerSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;
export type Glossary = z.infer<typeof glossarySchema>;
export type TranslationRequest = z.infer<typeof translationRequestSchema>;
export type TranslationHistoryEntry = z.infer<
  typeof translationHistoryEntrySchema
>;
export type DismissedNotices = z.infer<typeof dismissedNoticesSchema>;

/**
 * Fully-resolved provider ready to stream, built server-side only.
 *
 * Combines the catalog preset (`baseURL`/`models`/`defaultModel`/`name`) with
 * the DECRYPTED API key resolved from `provider_keys`. This type is NEVER
 * persisted and NEVER reaches the client bundle — it lives only in
 * `/api/translate` handler memory for the duration of one request.
 *
 * `streamTranslation` consumes this directly instead of synthesizing a
 * `Settings` object, since the server is now the sole caller and has all
 * the resolved data in hand.
 */
export type ResolvedProvider = {
  id: string;
  name: string;
  baseURL: string;
  models: string[];
  defaultModel: string;
  apiKey: string;
};
