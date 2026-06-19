<script lang="ts">
  import { _ } from "svelte-i18n";
  import { page } from "$app/stores";
  import Plus from "@lucide/svelte/icons/plus";
  import Menu from "@lucide/svelte/icons/menu";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import HistorySidebarList from "./HistorySidebarList.svelte";
  import SettingsPopover from "./SettingsPopover.svelte";
  import UserWidget from "./UserWidget.svelte";

  let mobileOpen = $state(false);

  let isTranslateActive = $derived($page.url.pathname === "/");
</script>

<!-- Desktop: fixed left rail (sticky, full viewport height). -->
<aside
  data-testid="app-sidebar"
  class="bg-card text-card-foreground hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-border"
>
  {@render sidebarInner()}
</aside>

<!-- Mobile: top bar with hamburger that opens the sidebar as a left drawer. -->
<header
  class="bg-card text-card-foreground md:hidden sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border px-3"
>
  <Button
    type="button"
    variant="ghost"
    size="icon"
    class="h-8 w-8"
    aria-label={$_("nav.open_settings")}
    data-testid="open-sidebar"
    onclick={() => (mobileOpen = true)}
  >
    <Menu class="h-5 w-5" />
  </Button>
  <a href="/" class="flex items-center gap-1.5 text-sm font-semibold">
    <span aria-hidden="true">🌐</span>
    {$_("app.title")}
  </a>
</header>

<Sheet.Root bind:open={mobileOpen}>
  <Sheet.Content side="left" data-testid="app-sidebar-mobile" class="w-64 p-0">
    {@render sidebarInner()}
  </Sheet.Content>
</Sheet.Root>

{#snippet sidebarInner()}
  <div class="flex h-full flex-col">
    <!-- App title -->
    <div class="flex h-14 items-center gap-2 border-b border-border px-4">
      <span aria-hidden="true">🌐</span>
      <a href="/" class="text-sm font-semibold text-foreground">
        {$_("app.title")}
      </a>
    </div>

    <!-- New translation -->
    <div class="p-2">
      <a
        href="/"
        data-testid="new-translation-link"
        aria-current={isTranslateActive ? "page" : undefined}
        class="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent aria-[current=page]:bg-accent"
      >
        <Plus class="h-4 w-4" />
        {$_("nav.new_translation")}
      </a>
    </div>

    <!-- Recent history (scrollable middle) -->
    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
      <h2
        class="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {$_("nav.recent_history")}
      </h2>
      <HistorySidebarList />
    </div>

    <!-- Footer: user widget + settings popover -->
    <div class="border-t border-border p-2">
      <UserWidget />
      <SettingsPopover />
    </div>
  </div>
{/snippet}
