<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { TranslationHistoryEntry } from '$lib/schemas';
	import {
		historyStore,
		removeHistoryEntry,
		clearHistory
	} from '$lib/stores/history';
	import HistoryList from '$lib/components/HistoryList.svelte';
	import HistoryDetailModal from '$lib/components/HistoryDetailModal.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

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
		if (confirm(UI.HISTORY_PAGE.CONFIRM_CLEAR)) {
			clearHistory();
		}
	}
</script>

<svelte:head>
	<title>{UI.HISTORY_PAGE.TITLE} – {UI.APP_TITLE}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-semibold text-foreground">
			{UI.HISTORY_PAGE.TITLE}
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
			{UI.HISTORY_PAGE.BUTTON_CLEAR_ALL}
		</Button>
	</header>

	<section class="flex flex-col gap-3">
		{#if entries.length === 0}
			<p
				data-testid="history-empty-message"
				class="text-sm text-muted-foreground bg-muted border border-dashed border-border rounded-md p-4 text-center"
			>
				{UI.HISTORY_PAGE.EMPTY_MESSAGE}
			</p>
		{:else}
			<HistoryList {entries} onshowdetail={handleShowDetail} ondelete={handleDelete} />
		{/if}
	</section>

	<footer class="text-xs text-muted-foreground">
		<p data-testid="history-limit-notice">{UI.HISTORY_PAGE.LIMIT_NOTICE}</p>
	</footer>
</div>

<HistoryDetailModal entry={selected} onclose={handleCloseDetail} />
