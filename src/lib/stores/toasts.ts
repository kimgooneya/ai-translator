/**
 * Toast notification store.
 *
 * A lightweight, dependency-free store for transient user-facing messages
 * (errors, warnings, confirmations). The store is the single shared bus that
 * {@link ToastContainer.svelte} renders; every part of the app surfaces
 * problems by calling {@link addToast} rather than `alert()`/inline strings.
 *
 * Lifecycle:
 *   - `addToast` enqueues a toast and schedules automatic removal after
 *     `timeoutMs` (default 5s; errors stay for 10s so the user has time to
 *     read them).
 *   - `removeToast` removes a toast immediately (used by the ✕ button and by
 *     the auto-dismiss timer).
 *
 * Design notes:
 *   - `setTimeout` is guarded for SSR / non-browser environments so importing
 *     this module never throws during SvelteKit server rendering.
 *   - IDs combine a timestamp + random suffix so two toasts added in the same
 *     millisecond never collide (no global counter, no module state to reset).
 *   - The store value is always a fresh array (`[...items, toast]`), so Svelte
 *     reactivity triggers reliably — we never mutate in place.
 */

import { writable } from "svelte/store";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  /** Unique id used as the keyed-each key and for removal. */
  id: string;
  type: ToastType;
  message: string;
  /** Milliseconds before automatic removal. */
  timeoutMs: number;
}

export interface AddToastOptions {
  type: ToastType;
  message: string;
  /** Override the default auto-dismiss delay. */
  timeoutMs?: number;
}

/** Default auto-dismiss delay per toast type. Errors linger longest. */
export const DEFAULT_TIMEOUT_MS: Readonly<Record<ToastType, number>> =
  Object.freeze({
    info: 5000,
    success: 5000,
    warning: 5000,
    error: 10000,
  });

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createToastsStore() {
  const { subscribe, update, set } = writable<Toast[]>([]);

  /**
   * Enqueue a toast. Schedules automatic removal after `timeoutMs`
   * (defaults to 5s, or 10s for errors). Returns the new toast's id so the
   * caller can dismiss it programmatically if needed.
   */
  function addToast(opts: AddToastOptions): string {
    const id = generateId();
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS[opts.type];
    const toast: Toast = {
      id,
      type: opts.type,
      message: opts.message,
      timeoutMs,
    };
    update((items) => [...items, toast]);
    if (typeof setTimeout !== "undefined") {
      setTimeout(() => removeToast(id), timeoutMs);
    }
    return id;
  }

  /** Remove the toast with the given id (no-op if it is no longer present). */
  function removeToast(id: string): void {
    update((items) => items.filter((t) => t.id !== id));
  }

  /** Remove every toast. Handy for tests / route resets. */
  function clearToasts(): void {
    set([]);
  }

  return { subscribe, addToast, removeToast, clearToasts };
}

export const toasts = createToastsStore();
