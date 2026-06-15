<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';

	let {
		expanded = $bindable(),
		customPrompt = $bindable(),
		glossaryEnabled,
		glossaryCount,
		onToggleGlossary
	}: {
		expanded: boolean;
		customPrompt: string;
		glossaryEnabled: boolean;
		glossaryCount: number;
		onToggleGlossary: () => void;
	} = $props();

	function toggle(): void {
		expanded = !expanded;
	}

	const textareaClass =
		'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
		'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 ' +
		'focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-y';
</script>

<section data-testid="advanced-options" class="flex flex-col gap-3">
	<button
		type="button"
		data-testid="advanced-options-toggle"
		onclick={toggle}
		aria-expanded={expanded}
		class="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition"
	>
		<svg
			class="w-4 h-4 transition-transform {expanded ? 'rotate-90' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
		</svg>
		{UI.TRANSLATE_PAGE.ADVANCED_OPTIONS}
	</button>

	{#if expanded}
		<div data-testid="advanced-options-content" class="flex flex-col gap-4 pl-6">
			<div class="flex flex-col gap-1.5">
				<label for="custom-prompt" class="text-sm text-gray-600 dark:text-gray-300">
					{UI.TRANSLATE_PAGE.LABEL_CUSTOM_PROMPT}
				</label>
				<textarea
					id="custom-prompt"
					data-testid="custom-prompt-input"
					placeholder={UI.TRANSLATE_PAGE.PLACEHOLDER_CUSTOM_PROMPT}
					rows="3"
					class={textareaClass}
					bind:value={customPrompt}
				></textarea>
			</div>

			<label
				for="glossary-toggle"
				class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none"
			>
			<input
				id="glossary-toggle"
				data-testid="glossary-toggle"
				type="checkbox"
				class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
				checked={glossaryEnabled}
				onchange={onToggleGlossary}
			/>
				{UI.TRANSLATE_PAGE.LABEL_GLOSSARY_TOGGLE}
				<span class="text-gray-400 dark:text-gray-500">
					({glossaryCount}개 용어)
				</span>
			</label>
		</div>
	{/if}
</section>
