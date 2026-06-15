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
		<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
			{UI.HISTORY_PAGE.TITLE}
		</h1>
		<button
			type="button"
			data-testid="history-clear-all-button"
			onclick={handleClearAll}
			disabled={entries.length === 0}
			class="px-3 py-1.5 rounded-md text-sm font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
		>
			{UI.HISTORY_PAGE.BUTTON_CLEAR_ALL}
		</button>
	</header>

	<section class="flex flex-col gap-3">
		{#if entries.length === 0}
			<p
				data-testid="history-empty-message"
				class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-md p-4 text-center"
			>
				{UI.HISTORY_PAGE.EMPTY_MESSAGE}
			</p>
		{:else}
			<HistoryList {entries} onshowdetail={handleShowDetail} ondelete={handleDelete} />
		{/if}
	</section>

	<footer class="text-xs text-gray-500 dark:text-gray-400">
		<p data-testid="history-limit-notice">{UI.HISTORY_PAGE.LIMIT_NOTICE}</p>
	</footer>
</div>

<HistoryDetailModal entry={selected} onclose={handleCloseDetail} />
