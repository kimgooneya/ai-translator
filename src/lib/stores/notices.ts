import { get } from "svelte/store";
import { persistedWritable } from "$lib/storage/stores";
import { dismissedNoticesSchema } from "$lib/schemas";
import { STORAGE_KEYS } from "$lib/storage";

const fallback: string[] = [];

export const dismissedNoticesStore = persistedWritable(
  STORAGE_KEYS.dismissedNotices,
  dismissedNoticesSchema,
  fallback,
);

/** Mark a notice id as dismissed (no-op if already present). */
export function dismissNotice(id: string): void {
  dismissedNoticesStore.update((ids) =>
    ids.includes(id) ? ids : [...ids, id],
  );
}

/** Return whether the given notice id has been dismissed. */
export function isNoticeDismissed(id: string): boolean {
  return get(dismissedNoticesStore).includes(id);
}
