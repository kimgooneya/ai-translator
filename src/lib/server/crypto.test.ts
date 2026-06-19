import { describe, it, expect } from "vitest";
import { encryptKey, decryptKey } from "./crypto";

describe("crypto (AES-256-GCM)", () => {
  describe("encryptKey / decryptKey round-trip", () => {
    it("round-trips a typical API key back to the original plaintext", () => {
      const plaintext = "sk-proj-abcdef0123456789";
      const stored = encryptKey(plaintext);
      expect(stored).not.toBe(plaintext);
      expect(decryptKey(stored)).toBe(plaintext);
    });

    it("round-trips a long key", () => {
      const plaintext = "x".repeat(256);
      expect(decryptKey(encryptKey(plaintext))).toBe(plaintext);
    });

    it("round-trips unicode/multibyte content", () => {
      const plaintext = "키-한글-日本語-🔑";
      expect(decryptKey(encryptKey(plaintext))).toBe(plaintext);
    });
  });

  describe("storage format", () => {
    it("produces three base64 parts separated by colons (iv:ciphertext:authTag)", () => {
      const stored = encryptKey("sk-test");
      const parts = stored.split(":");
      expect(parts).toHaveLength(3);
      // Each part must be valid base64.
      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });

    it("uses a fresh 12-byte IV on every encryption (no IV reuse)", () => {
      const plaintext = "sk-same-input";
      const a = encryptKey(plaintext);
      const b = encryptKey(plaintext);
      expect(a).not.toBe(b);
      const ivA = Buffer.from(a.split(":")[0], "base64");
      const ivB = Buffer.from(b.split(":")[0], "base64");
      expect(ivA.length).toBe(12);
      expect(ivB.length).toBe(12);
      expect(ivA.equals(ivB)).toBe(false);
    });

    it("produces a 16-byte authTag", () => {
      const stored = encryptKey("sk-test");
      const authTag = Buffer.from(stored.split(":")[2], "base64");
      expect(authTag.length).toBe(16);
    });
  });

  describe("tamper / wrong-key detection", () => {
    it("throws when the ciphertext is tampered with", () => {
      const stored = encryptKey("sk-original");
      const [ivB64, ciphertextB64, authTagB64] = stored.split(":");
      // Flip a bit in the ciphertext.
      const tamperedCiphertext = Buffer.from(ciphertextB64, "base64");
      tamperedCiphertext[0] ^= 0xff;
      const tampered = [
        ivB64,
        tamperedCiphertext.toString("base64"),
        authTagB64,
      ].join(":");
      expect(() => decryptKey(tampered)).toThrow();
    });

    it("throws when the authTag is swapped", () => {
      const stored = encryptKey("sk-original");
      const other = encryptKey("sk-different");
      const [ivB64, ciphertextB64] = stored.split(":");
      const [, , otherAuthTagB64] = other.split(":");
      const swapped = [ivB64, ciphertextB64, otherAuthTagB64].join(":");
      expect(() => decryptKey(swapped)).toThrow();
    });

    it("throws on malformed storage format (wrong part count)", () => {
      expect(() => decryptKey("not-enough-parts")).toThrow();
      expect(() => decryptKey("a:b:c:d")).toThrow();
    });

    it("throws on empty input", () => {
      expect(() => encryptKey("")).toThrow();
      expect(() => decryptKey("")).toThrow();
    });
  });
});
