<script lang="ts">
  import { page } from "$app/stores";
  import { toggleMode } from "mode-watcher";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import { _ } from "svelte-i18n";
  import { Button } from "$lib/components/ui/button/index.js";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";

  const links = [
    { href: "/", label: $_("nav.translate") },
    { href: "/settings", label: $_("nav.settings") },
    { href: "/glossary", label: $_("nav.glossary") },
    { href: "/history", label: $_("nav.history") },
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }
</script>

<nav class="bg-card text-card-foreground border-b border-border">
  <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
    <a href="/" class="text-lg text-foreground font-semibold"
      >{$_("app.title")}</a
    >
    <div class="flex items-center gap-4">
      {#each links as link (link.href)}
        <a
          href={link.href}
          class="text-sm px-2 py-1 rounded transition-colors {isActive(
            link.href,
            $page.url.pathname,
          )
            ? 'text-foreground font-medium bg-secondary'
            : 'text-muted-foreground hover:text-foreground'}"
          aria-current={isActive(link.href, $page.url.pathname)
            ? "page"
            : undefined}
        >
          {link.label}
        </a>
      {/each}
      <LanguageSwitcher />
      <Button
        variant="outline"
        size="icon"
        onclick={toggleMode}
        aria-label={$_("nav.theme_toggle")}
        data-testid="theme-toggle"
      >
        <Sun
          class="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
        />
        <Moon
          class="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
        />
      </Button>
    </div>
  </div>
</nav>
