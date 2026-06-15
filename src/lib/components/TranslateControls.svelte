<script lang="ts">
	import { AUTO_LANGUAGE, LANGUAGES } from '$lib/constants/languages';
	import { UI } from '$lib/constants/ui-strings';

	let {
		sourceLang = $bindable(),
		targetLang = $bindable(),
		model = $bindable(),
		availableModels,
		hasActiveProvider,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		hasApiKey,
		isLoading,
		canTranslate,
		ontranslate,
		oncancel
	}: {
		sourceLang: string;
		targetLang: string;
		model: string;
		availableModels: string[];
		hasActiveProvider: boolean;
		hasApiKey: boolean;
		isLoading: boolean;
		canTranslate: boolean;
		ontranslate: () => void;
		oncancel: () => void;
	} = $props();

	const selectClass =
		'px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
		'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 ' +
		'focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm';

	const allLanguages = [AUTO_LANGUAGE, ...LANGUAGES];
</script>

<div
	data-testid="translate-controls"
	class="flex flex-wrap items-end gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
>
	<div class="flex flex-col gap-1">
		<label for="source-lang" class="text-xs text-gray-500 dark:text-gray-400">
			{UI.TRANSLATE_PAGE.LABEL_SOURCE_LANG}
		</label>
		<select id="source-lang" data-testid="source-lang-select" class={selectClass} bind:value={sourceLang}>
			{#each allLanguages as lang (lang.code)}
				<option value={lang.code}>{lang.name}</option>
			{/each}
		</select>
	</div>

	<div class="flex items-center pb-2">
		<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
		</svg>
	</div>

	<div class="flex flex-col gap-1">
		<label for="target-lang" class="text-xs text-gray-500 dark:text-gray-400">
			{UI.TRANSLATE_PAGE.LABEL_TARGET_LANG}
		</label>
		<select id="target-lang" data-testid="target-lang-select" class={selectClass} bind:value={targetLang}>
			{#each LANGUAGES as lang (lang.code)}
				<option value={lang.code}>{lang.name}</option>
			{/each}
		</select>
	</div>

	<div class="flex flex-col gap-1">
		<label for="model-select" class="text-xs text-gray-500 dark:text-gray-400">
			{UI.TRANSLATE_PAGE.LABEL_MODEL}
		</label>
		<select
			id="model-select"
			data-testid="model-select"
			class={selectClass}
			bind:value={model}
			disabled={!hasActiveProvider || availableModels.length === 0}
		>
			{#if !hasActiveProvider || availableModels.length === 0}
				<option value="">—</option>
			{:else}
				{#each availableModels as m (m)}
					<option value={m}>{m}</option>
				{/each}
			{/if}
		</select>
	</div>

	<div class="flex items-end gap-2 ml-auto">
		{#if isLoading}
			<button
				type="button"
				data-testid="cancel-button"
				onclick={oncancel}
				class="px-4 py-2 rounded-md text-sm font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 transition"
			>
				{UI.TRANSLATE_PAGE.BUTTON_CANCEL}
			</button>
		{/if}
		<button
			type="button"
			data-testid="translate-button"
			onclick={ontranslate}
			disabled={!canTranslate}
			class="px-6 py-2 rounded-md text-sm font-medium transition {canTranslate
				? 'bg-blue-600 hover:bg-blue-700 text-white'
				: 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}"
		>
			{isLoading ? UI.TRANSLATE_PAGE.TRANSLATING : UI.TRANSLATE_PAGE.BUTTON_TRANSLATE}
		</button>
	</div>
</div>
