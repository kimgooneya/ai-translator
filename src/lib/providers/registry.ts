import OpenAI from "openai";
import { PRESET_PROVIDERS, isPresetId } from "./presets";
import type { Provider, ProviderConfig, Settings } from "$lib/schemas";

export function createProviderClient(
  config: ProviderConfig,
  baseURL: string,
): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL,
    dangerouslyAllowBrowser: false,
  });
}

export function getAllProviders(settings: Settings): Provider[] {
  const customs: Provider[] = settings.providers
    .filter((c) => !isPresetId(c.providerId))
    .map((c) => ({
      id: c.providerId,
      name: c.name ?? c.providerId,
      kind: "custom" as const,
      baseURL: c.baseURL ?? "",
      models: c.models ?? [c.selectedModel],
      defaultModel: c.defaultModel ?? c.selectedModel,
    }));
  return [...PRESET_PROVIDERS, ...customs];
}

export function getProviderById(
  settings: Settings,
  id: string,
): Provider | undefined {
  return getAllProviders(settings).find((p) => p.id === id);
}

export type ProviderConfigValidation = { valid: boolean; error?: string };

export function validateProviderConfig(
  config: ProviderConfig,
  provider: Provider,
): ProviderConfigValidation {
  if (!config.apiKey || config.apiKey.trim() === "") {
    return { valid: false, error: "API key is required" };
  }
  if (!provider.models.includes(config.selectedModel)) {
    return {
      valid: false,
      error: `Model "${config.selectedModel}" is not available for provider "${provider.name}"`,
    };
  }
  if (provider.kind === "custom") {
    if (!config.baseURL) {
      return {
        valid: false,
        error: "baseURL is required for custom providers",
      };
    }
  }
  return { valid: true };
}
