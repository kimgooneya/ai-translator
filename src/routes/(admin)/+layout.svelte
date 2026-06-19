<script lang="ts">
  import { _ } from "svelte-i18n";
  import { page } from "$app/stores";
  import Menu from "@lucide/svelte/icons/menu";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import UsersIcon from "@lucide/svelte/icons/users";
  import BarChart3 from "@lucide/svelte/icons/bar-chart-3";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import UserWidget from "$lib/components/UserWidget.svelte";

  let { children } = $props();
  let mobileOpen = $state(false);

  type NavItem = {
    href: string;
    labelKey: string;
    icon: typeof LayoutDashboard;
    testId: string;
  };

  const navItems: NavItem[] = [
    {
      href: "/admin",
      labelKey: "admin.nav.dashboard",
      icon: LayoutDashboard,
      testId: "admin-nav-dashboard",
    },
    {
      href: "/admin/providers",
      labelKey: "admin.nav.providers",
      icon: KeyRound,
      testId: "admin-nav-providers",
    },
    {
      href: "/admin/users",
      labelKey: "admin.nav.users",
      icon: UsersIcon,
      testId: "admin-nav-users",
    },
    {
      href: "/admin/stats",
      labelKey: "admin.nav.stats",
      icon: BarChart3,
      testId: "admin-nav-stats",
    },
  ];

  function isActive(href: string, pathname: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }
</script>

<div class="flex min-h-screen bg-background text-foreground">
  <aside
    data-testid="admin-sidebar"
    class="bg-card text-card-foreground hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-border"
  >
    {@render sidebarInner()}
  </aside>

  <header
    class="bg-card text-card-foreground md:hidden sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border px-3"
  >
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="h-8 w-8"
      aria-label={$_("admin.nav.open_menu")}
      data-testid="open-admin-sidebar"
      onclick={() => (mobileOpen = true)}
    >
      <Menu class="h-5 w-5" />
    </Button>
    <a href="/admin" class="flex items-center gap-1.5 text-sm font-semibold">
      <span aria-hidden="true">🛡️</span>
      {$_("admin.title")}
    </a>
  </header>

  <Sheet.Root bind:open={mobileOpen}>
    <Sheet.Content side="left" data-testid="admin-sidebar-mobile" class="w-64 p-0">
      {@render sidebarInner()}
    </Sheet.Content>
  </Sheet.Root>

  <main class="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
    {@render children()}
  </main>
</div>

{#snippet sidebarInner()}
  <div class="flex h-full flex-col">
    <div class="flex h-14 items-center gap-2 border-b border-border px-4">
      <span aria-hidden="true">🛡️</span>
      <span class="text-sm font-semibold text-foreground">
        {$_("admin.title")}
      </span>
    </div>

    <nav class="flex flex-col gap-0.5 p-2">
      {#each navItems as item (item.href)}
        {@const active = isActive(item.href, $page.url.pathname)}
        <a
          href={item.href}
          data-testid={item.testId}
          aria-current={active ? "page" : undefined}
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent aria-[current=page]:bg-accent"
        >
          <item.icon class="h-4 w-4" />
          {$_(item.labelKey)}
        </a>
      {/each}
    </nav>

    <div class="min-h-0 flex-1"></div>

    <div class="border-t border-border p-2">
      <a
        href="/"
        data-testid="admin-back-to-app"
        class="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <ArrowLeft class="h-4 w-4" />
        {$_("admin.nav.back_to_app")}
      </a>
      <UserWidget />
    </div>
  </div>
{/snippet}

