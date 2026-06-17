<script lang="ts">
  import { _ } from "svelte-i18n";
  import { toggleMode } from "mode-watcher";
  import Sun from "@lucide/svelte/icons/sun";
  import Moon from "@lucide/svelte/icons/moon";
  import Settings from "@lucide/svelte/icons/settings";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import History from "@lucide/svelte/icons/history";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Separator from "$lib/components/ui/separator/index.js";
  import LanguageSwitcher from "./LanguageSwitcher.svelte";
  import SettingsDialog from "./SettingsDialog.svelte";
  import GlossaryDialog from "./GlossaryDialog.svelte";

  let open = $state(false);

  // Dialog open state lives here so the popover can close itself before the
  // modal layer takes over (prevents the popover overlapping the dialog).
  let settingsOpen = $state(false);
  let glossaryOpen = $state(false);

  function toggle(): void {
    open = !open;
  }

  function openProviders(): void {
    open = false;
    settingsOpen = true;
  }

  function openGlossary(): void {
    open = false;
    glossaryOpen = true;
  }

  // The popover wrapper stops click propagation (see markup), so any click
  // that reaches `window` while open is by definition an outside click.
  function closeOnOutsideClick(): void {
    open = false;
  }

  function closeOnEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") open = false;
  }

  $effect(() => {
    if (!open) return;
    window.addEventListener("click", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative" onclick={(e) => e.stopPropagation()}>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
    aria-expanded={open}
    aria-haspopup="menu"
    data-testid="settings-popover-trigger"
    onclick={toggle}
  >
    <Settings class="h-4 w-4" />
    {$_("nav.settings")}
  </Button>

  {#if open}
    <div
      data-testid="settings-popover-content"
      role="menu"
      class="absolute bottom-full left-0 right-0 mb-2 z-50 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <button
        type="button"
        role="menuitem"
        data-testid="popover-provider-settings"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
        onclick={openProviders}
      >
        <Settings class="h-4 w-4" />
        {$_("nav.provider_settings")}
      </button>
      <button
        type="button"
        role="menuitem"
        data-testid="popover-glossary"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
        onclick={openGlossary}
      >
        <BookOpen class="h-4 w-4" />
        {$_("nav.glossary")}
      </button>
      <a
        href="/history"
        role="menuitem"
        data-testid="popover-view-all-history"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
      >
        <History class="h-4 w-4" />
        {$_("nav.view_all_history")}
      </a>

      <Separator.Root class="my-1" />

      <div class="flex items-center justify-between gap-2 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="h-8 w-8"
          onclick={toggleMode}
          aria-label={$_("nav.theme_toggle")}
          data-testid="theme-toggle"
        >
          <Sun
            class="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
          />
          <Moon
            class="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
          />
        </Button>
        <LanguageSwitcher />
      </div>
    </div>
  {/if}
</div>

<SettingsDialog bind:open={settingsOpen} />
<GlossaryDialog bind:open={glossaryOpen} />
