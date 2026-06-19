/**
 * AES-256-GCM encryption for provider API keys.
 *
 * Server-only (`$lib/server/*`) so Vite never bundles this for the browser.
 * The master key comes from `$env/static/private` (`ENCRYPTION_KEY`), a
 * 32-byte value stored base64-encoded. Keys are decrypted ONLY in the
 * `/api/translate` handler — in memory, never logged or returned.
 *
 * Storage format: `base64(iv):base64(ciphertext):base64(authTag)`
 *   - iv: 12 random bytes (unique per encryption — GCM requirement)
 *   - ciphertext: AES-256-GCM of the plaintext (same length as input)
 *   - authTag: 16 bytes (GCM authenticity guarantee; tamper → throw)
 *
 * Decrypting with the wrong master key or a tampered ciphertext throws —
 * GCM's authTag verification fails before any plaintext is exposed.
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { ENCRYPTION_KEY } from "$env/static/private";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_ENCODING_ERROR =
  "ENCRYPTION_KEY must be a base64-encoded 32-byte value (run: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")";

function getMasterKey(): Buffer {
  let raw: Buffer;
  try {
    raw = Buffer.from(ENCRYPTION_KEY, "base64");
  } catch {
    throw new Error(KEY_ENCODING_ERROR);
  }
  if (raw.length !== 32) {
    throw new Error(KEY_ENCODING_ERROR);
  }
  return raw;
}

/**
 * Encrypt a plaintext API key into the `iv:ciphertext:authTag` storage format.
 * A fresh random IV is used on every call.
 */
export function encryptKey(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptKey: plaintext must be a non-empty string");
  }
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by {@link encryptKey} back to the plaintext key.
 *
 * Throws on:
 *   - malformed storage format (wrong number of `:`-separated parts)
 *   - base64 decode failure
 *   - GCM authTag mismatch (tampered ciphertext OR wrong master key)
 *
 * The thrown error intentionally reveals NOTHING about the key or ciphertext —
 * callers must keep it that way (do not log the input on failure).
 */
export function decryptKey(stored: string): string {
  if (typeof stored !== "string" || stored.length === 0) {
    throw new Error("decryptKey: stored value must be a non-empty string");
  }
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptKey: malformed stored value");
  }
  const [ivB64, ciphertextB64, authTagB64] = parts;

  const key = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("decryptKey: malformed stored value");
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  // combined() concatenates update + final; throws if the authTag is invalid,
  // which is exactly the tamper / wrong-key signal we want to surface.
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
