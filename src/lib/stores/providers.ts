import { writable } from "svelte/store";
import type { Provider } from "$lib/schemas";

/**
 * Client-side cache of the admin-managed provider catalog (enabled
 * `provider_presets`), populated from `GET /api/user/providers`.
 *
 * This replaces the old static `PRESET_PROVIDERS` + user custom-provider
 * model (Q3: user custom providers removed). Users select only from the
 * admin-managed list; the catalog carries NO key material.
 *
 * Empty until the (app) layout calls {@link loadProviderCatalog} on mount.
 * Components that need it should read `$providerCatalogStore` and tolerate
 * an empty array (e.g. while the fetch is in flight).
 */
export const providerCatalogStore = writable<Provider[]>([]);
export const providerCatalogLoading = writable<boolean>(false);
export const providerCatalogError = writable<string | null>(null);

/**
 * Fetch the provider catalog from the server and populate the store.
 *
 * Idempotent and safe to call on every (app) layout mount. Auth cookies are
 * sent automatically (same-origin). Failures are surfaced via
 * {@link providerCatalogError} without throwing, so a transient network blip
 * never crashes the page — the user simply sees an empty provider list.
 */
export async function loadProviderCatalog(): Promise<void> {
  providerCatalogLoading.set(true);
  try {
    const res = await fetch("/api/user/providers", { method: "GET" });
    if (!res.ok) {
      providerCatalogError.set("프로바이더 목록을 불러오지 못했습니다");
      return;
    }
    const body = (await res.json()) as { providers?: Provider[] };
    providerCatalogStore.set(body.providers ?? []);
    providerCatalogError.set(null);
  } catch {
    providerCatalogError.set("프로바이더 목록을 불러오지 못했습니다");
  } finally {
    providerCatalogLoading.set(false);
  }
}
