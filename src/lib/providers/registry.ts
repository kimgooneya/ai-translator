import OpenAI from "openai";

/**
 * Build an OpenAI SDK client pointed at a provider's `baseURL`, authenticated
 * with the given `apiKey`.
 *
 * The `apiKey` is the DECRYPTED provider key (resolved server-side from
 * `provider_keys`); the `baseURL` comes from the `provider_presets` row.
 * `dangerouslyAllowBrowser` is hard-false: this client is only ever
 * constructed server-side inside `/api/translate`.
 */
export function createProviderClient(apiKey: string, baseURL: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: false,
  });
}
