<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card/index.js";

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
        loadError = $_("admin.stats.load_error");
        return;
      }
      stats = (await res.json()) as StatsResponse;
    } catch {
      loadError = $_("admin.stats.load_error");
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void load();
  });

  // Chart helpers — all inline, zero dependencies. SVG path for the daily
  // sparkline is built from the 7-day count series.
  let dailyMax = $derived(
    stats ? Math.max(1, ...stats.daily.map((d) => d.count)) : 1,
  );
  let providerMax = $derived(
    stats ? Math.max(1, ...stats.providers.map((p) => p.count)) : 1,
  );
  let providerCharsMax = $derived(
    stats ? Math.max(1, ...stats.providers.map((p) => p.chars)) : 1,
  );

  // SVG line path for the daily count sparkline (normalized to a 280×60 box).
  const SVG_W = 280;
  const SVG_H = 60;
  let dailyPath = $derived.by(() => {
    if (!stats || stats.daily.length === 0) return "";
    const step = SVG_W / Math.max(1, stats.daily.length - 1);
    return stats.daily
      .map((d, i) => {
        const x = i * step;
        const y = SVG_H - (d.count / dailyMax) * (SVG_H - 4) - 2;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  });

  function fmtDate(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  }
</script>

<svelte:head>
  <title>{$_("admin.stats.title")} – {$_("admin.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight text-foreground">
      {$_("admin.stats.title")}
    </h1>
    <p class="mt-1 text-sm text-muted-foreground">
      {$_("admin.stats.subtitle")}
    </p>
  </header>

  {#if loading}
    <p data-testid="admin-stats-loading" class="text-sm text-muted-foreground">
      {$_("admin.stats.loading")}
    </p>
  {:else if loadError}
    <p data-testid="admin-stats-error" class="text-sm text-destructive">
      {loadError}
    </p>
  {:else if stats}
    <!-- 7-day daily series (line chart) -->
    <Card.Root>
      <Card.Header>
        <Card.Title>{$_("admin.stats.daily_title")}</Card.Title>
        <Card.Description>
          {$_("admin.stats.daily_desc")}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-col gap-3">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            class="h-24 w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label={$_("admin.stats.daily_title")}
          >
            <path d={dailyPath} fill="none" stroke="currentColor" stroke-width="2" class="text-primary" />
          </svg>
          <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {#each stats.daily as point (point.date)}
              <div class="flex flex-col gap-0.5">
                <span>{fmtDate(point.date)}</span>
                <span class="font-medium text-foreground">{point.count}</span>
              </div>
            {/each}
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Per-provider count breakdown (CSS bar chart) -->
      <Card.Root>
        <Card.Header>
          <Card.Title>{$_("admin.stats.by_count_title")}</Card.Title>
        </Card.Header>
        <Card.Content>
          {#if stats.providers.length === 0}
            <p class="py-4 text-sm text-muted-foreground">
              {$_("admin.stats.no_data")}
            </p>
          {:else}
            <ul class="flex flex-col gap-2">
              {#each stats.providers as p (p.provider_id)}
                {@const pct = (p.count / providerMax) * 100}
                <li class="flex items-center gap-2" data-testid={`provider-bar-count-${p.provider_id}`}>
                  <span class="w-24 shrink-0 truncate text-xs font-mono" title={p.provider_id}>
                    {p.provider_id}
                  </span>
                  <div class="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div
                      class="h-full rounded-sm bg-primary"
                      style={`width: ${pct.toFixed(1)}%`}
                    ></div>
                  </div>
                  <span class="w-12 shrink-0 text-right text-xs tabular-nums">
                    {p.count}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </Card.Content>
      </Card.Root>

      <!-- Per-provider chars breakdown -->
      <Card.Root>
        <Card.Header>
          <Card.Title>{$_("admin.stats.by_chars_title")}</Card.Title>
        </Card.Header>
        <Card.Content>
          {#if stats.providers.length === 0}
            <p class="py-4 text-sm text-muted-foreground">
              {$_("admin.stats.no_data")}
            </p>
          {:else}
            <ul class="flex flex-col gap-2">
              {#each stats.providers as p (p.provider_id)}
                {@const pct = (p.chars / providerCharsMax) * 100}
                <li class="flex items-center gap-2" data-testid={`provider-bar-chars-${p.provider_id}`}>
                  <span class="w-24 shrink-0 truncate text-xs font-mono" title={p.provider_id}>
                    {p.provider_id}
                  </span>
                  <div class="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div
                      class="h-full rounded-sm bg-secondary"
                      style={`width: ${pct.toFixed(1)}%`}
                    ></div>
                  </div>
                  <span class="w-16 shrink-0 text-right text-xs tabular-nums">
                    {p.chars}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>
