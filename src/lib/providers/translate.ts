import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { TranslationRequest, Settings } from "$lib/schemas";
import { createProviderClient, getProviderById } from "./registry";

export function buildTranslationMessages(
  request: TranslationRequest,
): ChatCompletionMessageParam[] {
  const sourceLangDesc =
    request.sourceLang === "auto"
      ? "detect the source language automatically"
      : `source language: ${request.sourceLang}`;

  const glossaryClause =
    request.glossary?.enabled && request.glossary.entries.length > 0
      ? "\n\nAlways translate these terms as specified:\n" +
        request.glossary.entries
          .map((e) => `- "${e.source}" -> "${e.target}"`)
          .join("\n")
      : "";

  const customPromptClause = request.customPrompt
    ? `\n\nAdditional instruction: ${request.customPrompt}`
    : "";

  const systemPrompt = `You are a professional translator. Translate the user's text to ${request.targetLang}. The ${sourceLangDesc}. Preserve meaning, tone, and formatting.${glossaryClause}${customPromptClause}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: request.sourceText },
  ];
}

export async function streamTranslation(
  request: TranslationRequest,
  settings: Settings,
): Promise<ReadableStream<Uint8Array>> {
  const providerConfig = settings.providers.find(
    (p) => p.providerId === request.providerId,
  );
  if (!providerConfig) {
    throw new Error(`Provider ${request.providerId} not found in settings`);
  }

  const provider = getProviderById(settings, request.providerId);
  if (!provider) {
    throw new Error(`Provider ${request.providerId} not registered`);
  }

  const client = createProviderClient(
    { ...providerConfig, apiKey: request.apiKey },
    provider.baseURL,
  );
  const messages = buildTranslationMessages(request);

  const stream = await client.chat.completions.create({
    model: request.model,
    messages,
    stream: true,
    temperature: providerConfig.params?.temperature ?? 0.3,
  });

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? "";
          if (text) {
            const lines = text.split("\n");
            for (const line of lines) {
              controller.enqueue(encoder.encode(`data: ${line}\n\n`));
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
