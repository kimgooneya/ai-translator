<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { TranslationHistoryEntry } from '$lib/schemas';

	let { entry, onclose }: { entry: TranslationHistoryEntry | null; onclose: () => void } = $props();

	let createdAtLabel = $derived(
		entry ? UI.HISTORY_PAGE.CREATED_AT_FORMATTER(new Date(entry.createdAt)) : ''
	);

	function handleBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={entry ? handleKeydown : undefined} />

{#if entry}
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		data-testid="history-detail-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={handleBackdropClick}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
	>
		<div
			data-testid="history-detail-modal"
			role="dialog"
			aria-modal="true"
			aria-label={UI.HISTORY_PAGE.TITLE}
			class="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col"
		>
			<header
				class="flex items-center justify-between gap-4 p-4 border-b border-gray-200 dark:border-gray-700"
			>
				<h2 class="text-base font-semibold text-gray-800 dark:text-gray-100">
					{UI.HISTORY_PAGE.TITLE}
				</h2>
				<button
					type="button"
					data-testid="history-detail-close"
					onclick={() => onclose()}
					class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl leading-none px-2"
					aria-label="닫기"
				>
					&times;
				</button>
			</header>

			<div class="flex flex-col gap-4 p-4 overflow-y-auto">
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
					<span
						data-testid="history-detail-created-at"
						class="text-gray-500 dark:text-gray-400 tabular-nums"
					>
						{createdAtLabel}
					</span>
					<span
						data-testid="history-detail-provider"
						class="font-medium text-gray-700 dark:text-gray-200"
					>
						{entry.providerName}
					</span>
					<span
						data-testid="history-detail-model"
						class="text-gray-500 dark:text-gray-400 break-all"
					>
						{entry.modelName}
					</span>
					{#if entry.tokensUsed !== undefined}
						<span
							data-testid="history-detail-tokens"
							class="text-xs text-gray-500 dark:text-gray-400"
						>
							tokens: {entry.tokensUsed}
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2 text-sm">
					<span
						data-testid="history-detail-source-lang"
						class="font-medium text-gray-700 dark:text-gray-200"
					>
						{entry.request.sourceLang}
					</span>
					<span class="text-gray-400 dark:text-gray-500" aria-hidden="true">→</span>
					<span
						data-testid="history-detail-target-lang"
						class="font-medium text-gray-700 dark:text-gray-200"
					>
						{entry.request.targetLang}
					</span>
				</div>

				{#if entry.request.customPrompt}
					<div class="flex flex-col gap-1">
						<span class="text-xs font-medium text-gray-600 dark:text-gray-300">
							{UI.TRANSLATE_PAGE.LABEL_CUSTOM_PROMPT}
						</span>
						<p
							data-testid="history-detail-custom-prompt"
							class="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 break-words whitespace-pre-wrap"
						>
							{entry.request.customPrompt}
						</p>
					</div>
				{/if}

				{#if entry.request.glossary}
					<div data-testid="history-detail-glossary" class="text-xs text-gray-600 dark:text-gray-300">
						{UI.TRANSLATE_PAGE.LABEL_GLOSSARY_TOGGLE}:
						{entry.request.glossary.enabled ? '사용' : '미사용'}
						{#if entry.request.glossary.entries.length > 0}
							({entry.request.glossary.entries.length}개)
						{/if}
					</div>
				{/if}

				<div class="flex flex-col gap-1">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-300">
						{UI.TRANSLATE_PAGE.PLACEHOLDER_SOURCE}
					</span>
					<p
						data-testid="history-detail-source"
						class="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 break-words whitespace-pre-wrap"
					>
						{entry.request.sourceText}
					</p>
				</div>

				<div class="flex flex-col gap-1">
					<span class="text-xs font-medium text-gray-600 dark:text-gray-300">
						{UI.TRANSLATE_PAGE.PLACEHOLDER_RESULT}
					</span>
					<p
						data-testid="history-detail-response"
						class="text-sm text-gray-800 dark:text-gray-100 bg-blue-50 dark:bg-blue-900/20 rounded-md p-3 break-words whitespace-pre-wrap"
					>
						{entry.response}
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}
