<script lang="ts">
  import { _ } from "svelte-i18n";
  import type { TranslationHistoryEntry } from "$lib/schemas";
  import {
    historyStore,
    removeHistoryEntry,
    clearHistory,
  } from "$lib/stores/history";
  import HistoryList from "$lib/components/HistoryList.svelte";
  import HistoryDetailInline from "$lib/components/HistoryDetailInline.svelte";
  import { Button } from "$lib/components/ui/button/index.js";

  let entries = $derived($historyStore);
  let selected = $state<TranslationHistoryEntry | null>(null);

  function handleShowDetail(entry: TranslationHistoryEntry): void {
    selected = entry;
  }

  function handleCloseDetail(): void {
    selected = null;
  }

  function handleDelete(id: string): void {
    removeHistoryEntry(id);
  }

  function handleClearAll(): void {
    if (confirm($_("history_page.confirm_clear"))) {
      clearHistory();
    }
  }
</script>

<svelte:head>
  <title>{$_("history_page.title")} – {$_("app.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
  <header class="flex items-center justify-between gap-4">
    <h1 class="text-2xl font-semibold text-foreground">
      {$_("history_page.title")}
    </h1>
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-testid="history-clear-all-button"
      onclick={handleClearAll}
      disabled={entries.length === 0}
      class="text-destructive hover:text-destructive"
    >
      {$_("history_page.button_clear_all")}
    </Button>
  </header>

  {#if selected}
    <HistoryDetailInline entry={selected} onclose={handleCloseDetail} />
  {/if}

  <section class="flex flex-col gap-3">
    {#if entries.length === 0}
      <p
        data-testid="history-empty-message"
        class="text-sm text-muted-foreground bg-muted border border-dashed border-border rounded-md p-4 text-center"
      >
        {$_("history_page.empty_message")}
      </p>
    {:else}
      <HistoryList
        {entries}
        onshowdetail={handleShowDetail}
        ondelete={handleDelete}
      />
    {/if}
  </section>

  <footer class="text-xs text-muted-foreground">
    <p data-testid="history-limit-notice">{$_("history_page.limit_notice")}</p>
  </footer>
</div>
