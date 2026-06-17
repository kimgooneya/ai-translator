<script lang="ts">
  import { _ } from "svelte-i18n";
  import { historyStore } from "$lib/stores/history";
  import { formatDate } from "$lib/i18n";

  /** Maximum number of recent entries shown in the sidebar. */
  const MAX_ENTRIES = 15;
  const PREVIEW_LEN = 40;

  let entries = $derived($historyStore.slice(0, MAX_ENTRIES));

  function preview(text: string): string {
    const single = text.replace(/\s+/g, " ").trim();
    return single.length > PREVIEW_LEN
      ? single.slice(0, PREVIEW_LEN) + "..."
      : single;
  }

  /**
   * Return the i18n key + count for a relative-time label, or null when the
   * entry is older than ~30 days (caller falls back to an absolute date).
   */
  function relativeTime(createdAt: string): { key: string; n: number } | null {
    const seconds = Math.floor(
      (Date.now() - new Date(createdAt).getTime()) / 1000,
    );
    if (seconds < 60) return { key: "nav.time_ago_minutes", n: 1 };
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return { key: "nav.time_ago_minutes", n: minutes };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { key: "nav.time_ago_hours", n: hours };
    const days = Math.floor(hours / 24);
    if (days < 30) return { key: "nav.time_ago_days", n: days };
    return null;
  }

  function timeLabel(createdAt: string): string {
    const rel = relativeTime(createdAt);
    if (rel) {
      return $_(rel.key, { values: { n: rel.n } });
    }
    return formatDate(new Date(createdAt));
  }
</script>

<nav
  data-testid="sidebar-history-list"
  class="flex flex-col gap-1"
  aria-label={$_("nav.recent_history")}
>
  {#if entries.length === 0}
    <p class="px-2 py-3 text-xs text-muted-foreground">
      {$_("nav.no_history")}
    </p>
  {:else}
    {#each entries as entry (entry.id)}
      <a
        href="/history"
        data-testid="sidebar-history-item"
        data-entry-id={entry.id}
        class="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          class="text-xs text-foreground truncate"
          data-testid="sidebar-history-source"
        >
          {preview(entry.request.sourceText)}
        </span>
        <span
          class="text-[11px] text-muted-foreground tabular-nums"
          data-testid="sidebar-history-time"
        >
          {timeLabel(entry.createdAt)}
        </span>
      </a>
    {/each}
  {/if}
</nav>
