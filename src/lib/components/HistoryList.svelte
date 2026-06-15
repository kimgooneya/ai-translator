<script lang="ts">
	import type { TranslationHistoryEntry } from '$lib/schemas';
	import HistoryEntryCard from './HistoryEntryCard.svelte';

	let {
		entries,
		onshowdetail,
		ondelete
	}: {
		entries: TranslationHistoryEntry[];
		onshowdetail: (entry: TranslationHistoryEntry) => void;
		ondelete: (id: string) => void;
	} = $props();
</script>

<div data-testid="history-list" class="flex flex-col gap-3">
	{#each entries as entry (entry.id)}
		<HistoryEntryCard {entry} {onshowdetail} {ondelete} />
	{/each}
</div>
