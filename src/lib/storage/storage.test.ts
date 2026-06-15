import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  loadFromStorage,
  saveToStorage,
  removeFromStorage,
  STORAGE_KEYS,
} from "./index";
import { persistedWritable } from "./stores";

const testSchema = z.object({
  name: z.string(),
  count: z.number(),
});

const fallback = { name: "default", count: 0 };

beforeEach(() => {
  localStorage.clear();
});

describe("loadFromStorage", () => {
  it("returns fallback when key missing", () => {
    expect(loadFromStorage("nope", testSchema, fallback)).toEqual(fallback);
  });

  it("returns parsed value when valid", () => {
    localStorage.setItem("k", JSON.stringify({ name: "x", count: 5 }));
    expect(loadFromStorage("k", testSchema, fallback)).toEqual({
      name: "x",
      count: 5,
    });
  });

  it("returns fallback when JSON malformed", () => {
    localStorage.setItem("k", "{not json");
    expect(loadFromStorage("k", testSchema, fallback)).toEqual(fallback);
  });

  it("returns fallback when schema validation fails", () => {
    localStorage.setItem("k", JSON.stringify({ name: "x" }));
    expect(loadFromStorage("k", testSchema, fallback)).toEqual(fallback);
  });
});

describe("saveToStorage", () => {
  it("saves valid value and returns ok", () => {
    const result = saveToStorage("k", { name: "x", count: 1 }, testSchema);
    expect(result.ok).toBe(true);
    expect(localStorage.getItem("k")).toBe('{"name":"x","count":1}');
  });

  it("rejects value failing schema and does not write", () => {
    const result = saveToStorage(
      "k",
      { name: "x" } as unknown as { name: string; count: number },
      testSchema,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid");
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("returns quota error when localStorage.setItem throws QuotaExceededError", () => {
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    try {
      const result = saveToStorage("k", { name: "x", count: 1 }, testSchema);
      expect(result.ok).toBe(false);
      expect(result.error).toBe("quota");
    } finally {
      localStorage.setItem = original;
    }
  });
});

describe("removeFromStorage", () => {
  it("removes existing key", () => {
    localStorage.setItem("k", "v");
    removeFromStorage("k");
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("is a no-op for missing key", () => {
    expect(() => removeFromStorage("nope")).not.toThrow();
  });
});

describe("STORAGE_KEYS", () => {
  it("has the expected namespaces", () => {
    expect(STORAGE_KEYS.settings).toBe("translator.settings");
    expect(STORAGE_KEYS.glossary).toBe("translator.glossary");
    expect(STORAGE_KEYS.history).toBe("translator.history");
    expect(STORAGE_KEYS.theme).toBe("translator.theme");
  });
});

describe("persistedWritable", () => {
  it("initializes with fallback when localStorage empty", () => {
    const store = persistedWritable("pw", testSchema, fallback);
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value).toEqual(fallback);
    unsub();
  });

  it("initializes from localStorage when present", () => {
    localStorage.setItem("pw", JSON.stringify({ name: "loaded", count: 7 }));
    const store = persistedWritable("pw", testSchema, fallback);
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value).toEqual({ name: "loaded", count: 7 });
    unsub();
  });

  it("persists updates to localStorage", () => {
    const store = persistedWritable("pw", testSchema, fallback);
    store.set({ name: "updated", count: 99 });
    expect(localStorage.getItem("pw")).toBe(
      JSON.stringify({ name: "updated", count: 99 }),
    );
  });

  it("reset() clears localStorage and restores fallback", () => {
    localStorage.setItem("pw", JSON.stringify({ name: "loaded", count: 1 }));
    const store = persistedWritable("pw", testSchema, fallback);
    store.reset();
    expect(localStorage.getItem("pw")).toBeNull();
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value).toEqual(fallback);
    unsub();
  });

  it("handles corrupted localStorage by falling back", () => {
    localStorage.setItem("pw", "{broken");
    const store = persistedWritable("pw", testSchema, fallback);
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value).toEqual(fallback);
    unsub();
  });

  it("applies the migrate callback to the loaded value before init", () => {
    localStorage.setItem(
      "pw-migrate",
      JSON.stringify({ name: "loaded", count: 5 }),
    );
    const store = persistedWritable(
      "pw-migrate",
      testSchema,
      fallback,
      (v) => ({ ...v, count: v.count + 10 }),
    );
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value).toEqual({ name: "loaded", count: 15 });
    unsub();
  });

  it("applies the migrate callback to the fallback when storage is empty", () => {
    const store = persistedWritable(
      "pw-empty",
      testSchema,
      fallback,
      (v) => ({ ...v, name: v.name + "-migrated" }),
    );
    let value: { name: string; count: number } | undefined;
    const unsub = store.subscribe((v) => (value = v));
    expect(value?.name).toBe(fallback.name + "-migrated");
    unsub();
  });
});
