<script lang="ts">
  import "../app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { Toaster } from "$lib/components/ui/sonner/index.js";
  import { ModeWatcher } from "mode-watcher";
  import { toast } from "svelte-sonner";
  import { _, locale, getLocaleFromNavigator } from "svelte-i18n";
  import { get } from "svelte/store";
  import { initI18n, DEFAULT_LOCALE, isSupportedLocale } from "$lib/i18n";
  import { localeStore } from "$lib/stores/locale";

  let { children } = $props();

  // Initialize svelte-i18n once on first load with the best available locale.
  // SPA only (`ssr = false`) so this runs client-side before children render.
  const persistedLocale = get(localeStore);
  const navigatorLocale = getLocaleFromNavigator()?.split("-")[0];
  const initialLocale = isSupportedLocale(persistedLocale)
    ? persistedLocale
    : isSupportedLocale(navigatorLocale)
      ? navigatorLocale
      : DEFAULT_LOCALE;
  initI18n(initialLocale);

  // One-way sync: `localeStore` (persisted source of truth) → svelte-i18n
  // `$locale`. The language switcher writes to `localeStore`; we propagate so
  // `$_()` re-renders across the app. Subscribed inside `$effect` for cleanup.
  $effect(() => {
    return localeStore.subscribe((value) => {
      if (get(locale) !== value) {
        locale.set(value);
      }
    });
  });

  // Mirror svelte-i18n's active locale onto `<html lang>` for a11y/SEO.
  // `$locale` auto-subscribes this `$effect` to locale changes.
  $effect(() => {
    const value = $locale;
    if (typeof document !== "undefined" && value) {
      document.documentElement.lang = value;
    }
  });

  // Surface network connectivity changes as transient toasts. The `$_()`
  // calls run at event time so they always reflect the current locale.
  $effect(() => {
    if (typeof window === "undefined") return;

    function handleOffline(): void {
      toast.warning($_("layout.network_offline"));
    }
    function handleOnline(): void {
      toast.info($_("layout.network_online"));
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
<Toaster />

{@render children()}
