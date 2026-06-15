import { writable, type Writable } from "svelte/store";
import type { z } from "zod";
import { loadFromStorage, saveToStorage, removeFromStorage } from "./index";
import { toast } from "svelte-sonner";
import { UI } from "$lib/constants/ui-strings";

export interface PersistedWritable<T> extends Writable<T> {
  reset(): void;
}

export function persistedWritable<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
  migrate?: (value: T) => T,
): PersistedWritable<T> {
  const loaded = loadFromStorage(key, schema, fallback);
  const initial = migrate ? migrate(loaded) : loaded;
  const store = writable<T>(initial);
  let skipPersist = false;
  // Avoid firing a duplicate storage-full toast for every subscriber notified
  // of the same failing value. Reset once a successful save lands.
  let lastQuotaWarningFor: unknown = undefined;

  store.subscribe((value) => {
    if (skipPersist) return;
    const result = saveToStorage(key, value, schema);
    if (!result.ok && result.error !== "unavailable") {
      console.warn(
        `[persistedWritable] save to "${key}" failed:`,
        result.message,
      );
      if (result.error === "quota" && lastQuotaWarningFor !== value) {
        lastQuotaWarningFor = value;
        toast.warning(UI.ERRORS.STORAGE_FULL);
      }
    } else if (result.ok) {
      lastQuotaWarningFor = undefined;
    }
  });

  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    reset() {
      skipPersist = true;
      removeFromStorage(key);
      store.set(fallback);
      skipPersist = false;
    },
  };
}
