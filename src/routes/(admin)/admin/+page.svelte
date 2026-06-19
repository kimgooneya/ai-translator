<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import UsersIcon from "@lucide/svelte/icons/users";
  import Languages from "@lucide/svelte/icons/languages";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Type from "@lucide/svelte/icons/type";

  type StatsResponse = {
    totals: {
      total_users: number;
      total_translations: number;
      total_chars: number;
      active_presets_with_keys: number;
    };
    providers: Array<{ provider_id: string; count: number; chars: number }>;
    daily: Array<{ date: string; count: number; chars: number }>;
    recent: Array<{
      id: string;
      provider_id: string;
      model: string;
      source_lang: string;
      target_lang: string;
      input_chars: number;
      output_chars: number;
      status: "ok" | "error";
      created_at: string;
    }>;
  };

  let stats = $state<StatsResponse | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  async function load(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        loadError = $_("admin.dashboard.load_error");
        return;
      }
      stats = (await res.json()) as StatsResponse;
    } catch {
      loadError = $_("admin.dashboard.load_error");
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  let totals = $derived(stats?.totals);
</script>

<svelte:head>
  <title>{$_("admin.dashboard.title")} – {$_("admin.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      {$_("admin.dashboard.title")}
    </h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {$_("admin.dashboard.subtitle")}
    </p>
  </header>

  {#if loading}
    <p data-testid="admin-dashboard-loading" class="text-sm text-muted-foreground">
      {$_("admin.dashboard.loading")}
    </p>
  {:else if loadError}
    <p data-testid="admin-dashboard-error" class="text-sm text-destructive">
      {loadError}
    </p>
  {:else if totals}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card.Root data-testid="stat-card-users">
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium text-muted-foreground">
            {$_("admin.dashboard.total_users")}
          </Card.Title>
          <UsersIcon class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{totals.total_users}</div>
        </Card.Content>
      </Card.Root>

      <Card.Root data-testid="stat-card-translations">
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium text-muted-foreground">
            {$_("admin.dashboard.total_translations")}
          </Card.Title>
          <Languages class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{totals.total_translations}</div>
        </Card.Content>
      </Card.Root>

      <Card.Root data-testid="stat-card-chars">
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium text-muted-foreground">
            {$_("admin.dashboard.total_chars")}
          </Card.Title>
          <Type class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{totals.total_chars}</div>
        </Card.Content>
      </Card.Root>

      <Card.Root data-testid="stat-card-active-keys">
        <Card.Header class="flex flex-row items-center justify-between pb-2">
          <Card.Title class="text-sm font-medium text-muted-foreground">
            {$_("admin.dashboard.active_providers")}
          </Card.Title>
          <KeyRound class="h-4 w-4 text-muted-foreground" />
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">
            {totals.active_presets_with_keys}
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>{$_("admin.dashboard.recent_activity")}</Card.Title>
      </Card.Header>
      <Card.Content>
        {#if stats && stats.recent.length > 0}
          <ul class="flex flex-col divide-y divide-border">
            {#each stats.recent as row (row.id)}
              <li class="flex items-center justify-between py-2 text-sm">
                <div class="flex flex-col gap-0.5">
                  <span class="font-medium text-foreground">
                    {row.source_lang} → {row.target_lang}
                    <span class="text-muted-foreground">
                      · {row.provider_id} / {row.model}
                    </span>
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                    · {row.input_chars}→{row.output_chars} chars
                  </span>
                </div>
                <Badge variant={row.status === "ok" ? "secondary" : "destructive"}>
                  {row.status}
                </Badge>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="py-4 text-sm text-muted-foreground">
            {$_("admin.dashboard.no_recent_activity")}
          </p>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</div>
