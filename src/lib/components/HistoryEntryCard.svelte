<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { TranslationHistoryEntry } from '$lib/schemas';

	let {
		entry,
		onshowdetail,
		ondelete
	}: {
		entry: TranslationHistoryEntry;
		onshowdetail: (entry: TranslationHistoryEntry) => void;
		ondelete: (id: string) => void;
	} = $props();

	function preview(text: string, n = 50): string {
		return text.length > n ? text.slice(0, n) + '...' : text;
	}

	let createdAtLabel = $derived(
		UI.HISTORY_PAGE.CREATED_AT_FORMATTER(new Date(entry.createdAt))
	);
	let sourcePreview = $derived(preview(entry.request.sourceText));
	let responsePreview = $derived(preview(entry.response));
</script>

<article
	data-testid="history-entry-card"
	data-entry-id={entry.id}
	class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3"
>
	<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
		<span
			data-testid="history-created-at"
			class="text-xs text-gray-500 dark:text-gray-400 tabular-nums"
		>
			{createdAtLabel}
		</span>
		<span
			data-testid="history-provider"
			class="text-xs font-medium text-gray-700 dark:text-gray-200"
		>
			{entry.providerName}
		</span>
		<span
			data-testid="history-model"
			class="text-xs text-gray-500 dark:text-gray-400 break-all"
		>
			{entry.modelName}
		</span>
	</div>

	<div class="flex flex-wrap items-center gap-2 text-sm">
		<span
			data-testid="history-source-lang"
			class="font-medium text-gray-700 dark:text-gray-200"
		>
			{entry.request.sourceLang}
		</span>
		<span class="text-gray-400 dark:text-gray-500" aria-hidden="true">→</span>
		<span
			data-testid="history-target-lang"
			class="font-medium text-gray-700 dark:text-gray-200"
		>
			{entry.request.targetLang}
		</span>
	</div>

	<p
		data-testid="history-source-preview"
		class="text-sm text-gray-700 dark:text-gray-200 break-words"
	>
		{sourcePreview}
	</p>
	<p
		data-testid="history-response-preview"
		class="text-sm text-gray-800 dark:text-gray-100 break-words"
	>
		{responsePreview}
	</p>

	<div class="flex items-center gap-2 self-end">
		<button
			type="button"
			data-testid="history-detail-button"
			onclick={() => onshowdetail(entry)}
			class="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
		>
			{UI.HISTORY_PAGE.BUTTON_DETAIL}
		</button>
		<button
			type="button"
			data-testid="history-delete-button"
			onclick={() => ondelete(entry.id)}
			class="px-3 py-1.5 rounded-md text-sm font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 transition"
		>
			{UI.HISTORY_PAGE.BUTTON_DELETE}
		</button>
	</div>
</article>
