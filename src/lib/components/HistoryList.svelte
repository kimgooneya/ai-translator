<script lang="ts">
	import type { TranslationHistoryEntry } from '$lib/schemas';
	import * as ScrollArea from '$lib/components/ui/scroll-area/index.js';
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

<ScrollArea.Root
	data-testid="history-list"
	class="max-h-[calc(100vh-12rem)] w-full"
>
	<div class="flex flex-col gap-3">
		{#each entries as entry (entry.id)}
			<HistoryEntryCard {entry} {onshowdetail} {ondelete} />
		{/each}
	</div>
</ScrollArea.Root>
