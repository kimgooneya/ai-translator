<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { GlossaryEntry } from '$lib/schemas';

	let {
		entry,
		onedit,
		ondelete
	}: {
		entry: GlossaryEntry;
		onedit: (id: string) => void;
		ondelete: (id: string) => void;
	} = $props();
</script>

<article
	data-testid="glossary-entry-row"
	data-entry-id={entry.id}
	class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
>
	<div class="flex flex-col gap-1 min-w-0 flex-1">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span
				data-testid="entry-source"
				class="text-sm font-semibold text-gray-800 dark:text-gray-100 break-all"
			>
				{entry.source}
			</span>
			<span class="text-gray-400 dark:text-gray-500" aria-hidden="true">→</span>
			<span
				data-testid="entry-target"
				class="text-sm text-gray-700 dark:text-gray-200 break-all"
			>
				{entry.target}
			</span>
		</div>
		{#if entry.note}
			<p data-testid="entry-note" class="text-xs text-gray-500 dark:text-gray-400 break-all">
				{entry.note}
			</p>
		{/if}
	</div>

	<div class="flex items-center gap-2 shrink-0">
		<button
			type="button"
			data-testid="edit-button"
			onclick={() => onedit(entry.id)}
			class="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
		>
			{UI.GLOSSARY_PAGE.BUTTON_EDIT}
		</button>
		<button
			type="button"
			data-testid="delete-button"
			onclick={() => ondelete(entry.id)}
			class="px-3 py-1.5 rounded-md text-sm font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 transition"
		>
			{UI.GLOSSARY_PAGE.BUTTON_DELETE}
		</button>
	</div>
</article>
