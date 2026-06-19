/**
 * Server-side provider-key resolution helpers.
 *
 * Server-only (`$lib/server/*`). These query the Supabase admin
 * (service_role) client to read `provider_presets` and `provider_keys`, and
 * decrypt the active key in memory. The decrypted key is consumed ONLY by
 * the `/api/translate` handler and never returned to the client or logged.
 */

import type {
  ProviderPresetRow,
  ProviderKeyRow,
} from "$lib/supabase/database.types";
import { createSupabaseAdminClient } from "./supabase-admin";
import { decryptKey } from "./crypto";

/**
 * Thrown when a provider has no enabled key in `provider_keys`.
 * The `/api/translate` handler maps this to 401 `INVALID_API_KEY` with an
 * admin-facing message (the admin must add a key for that provider).
 */
export class NoActiveKeyError extends Error {
  readonly providerId: string;
  constructor(providerId: string) {
    super(`No active API key for provider "${providerId}"`);
    this.name = "NoActiveKeyError";
    this.providerId = providerId;
  }
}

/**
 * Thrown when decryption fails (tampered ciphertext or wrong master key).
 * Mapped to 500 `PROVIDER_ERROR`. Carries NO key/ciphertext material.
 */
export class KeyDecryptionError extends Error {
  readonly providerId: string;
  constructor(providerId: string) {
    super(`Failed to decrypt stored key for provider "${providerId}"`);
    this.name = "KeyDecryptionError";
    this.providerId = providerId;
  }
}

/**
 * Fetch a single enabled preset by id. Returns `null` if the preset is
 * disabled or absent (the provider is not available to users).
 */
export async function getEnabledPreset(
  providerId: string,
): Promise<ProviderPresetRow | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_presets")
    .select("*")
    .eq("id", providerId)
    .eq("enabled", true)
    .maybeSingle();
  if (error) {
    throw new Error(`provider_presets lookup failed: ${error.message}`);
  }
  return data;
}

/**
 * Resolve the most recent enabled key for a provider and decrypt it.
 *
 * Throws {@link NoActiveKeyError} when no enabled key exists (401 for the
 * caller) and {@link KeyDecryptionError} on decryption failure (500). The
 * decrypted plaintext is returned to the caller in memory only.
 */
export async function resolveActiveKey(providerId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_keys")
    .select("*")
    .eq("provider_id", providerId)
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`provider_keys lookup failed: ${error.message}`);
  }
  const row = data as ProviderKeyRow | null;
  if (!row) {
    throw new NoActiveKeyError(providerId);
  }
  try {
    return decryptKey(row.encrypted_key);
  } catch {
    // Wrap so callers map to PROVIDER_ERROR without leaking crypto details.
    throw new KeyDecryptionError(providerId);
  }
}

/**
 * List all enabled presets ordered by `sort_order` for the user-facing
 * provider catalog. Returns NO key material — `provider_keys` is never
 * touched here, and `provider_presets` carries no secrets by design.
 */
export async function listEnabledPresets(): Promise<ProviderPresetRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("provider_presets")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new Error(`provider_presets list failed: ${error.message}`);
  }
  return (data ?? []) as ProviderPresetRow[];
}
