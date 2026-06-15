<script lang="ts">
	import { untrack } from 'svelte';
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';

	let {
		provider,
		config,
		onsave,
		ondelete
	}: {
		provider: Provider;
		config: ProviderConfig | undefined;
		onsave: (config: ProviderConfig) => void;
		ondelete?: () => void;
	} = $props();

	// Local editable state — intentionally initialized from the config prop once
	// (uncontrolled component). The dirty check below re-reads `config` reactively
	// via $derived, so indicator/save state stays in sync with persisted data.
	let apiKey = $state(untrack(() => config?.apiKey ?? ''));
	let selectedModel = $state(untrack(() => config?.selectedModel ?? provider.defaultModel));

	// Dirty when local edits diverge from the persisted config.
	let isDirty = $derived(
		apiKey !== (config?.apiKey ?? '') ||
			selectedModel !== (config?.selectedModel ?? provider.defaultModel)
	);

	let hasApiKey = $derived((config?.apiKey ?? '').trim() !== '');
	let isCustom = $derived(provider.kind === 'custom');

	const inputClass =
		'w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 ' +
		'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 ' +
		'focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition';

	function handleSave(): void {
		const next: ProviderConfig = {
			providerId: provider.id,
			apiKey: apiKey.trim(),
			selectedModel,
			...(isCustom ? { baseURL: provider.baseURL } : {})
		};
		onsave(next);
	}

	function handleDelete(): void {
		ondelete?.();
	}
</script>

<article
	data-testid="provider-card"
	data-provider-id={provider.id}
	class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3"
>
	<header class="flex items-center justify-between gap-2">
		<h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">{provider.name}</h3>
		<span
			class="text-xs px-2 py-0.5 rounded-full {hasApiKey
				? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
				: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}"
		>
			{hasApiKey ? UI.SETTINGS_PAGE.API_KEY_SET : UI.SETTINGS_PAGE.API_KEY_EMPTY}
		</span>
	</header>

	<div class="flex flex-col gap-1.5">
		<label
			for="api-key-{provider.id}"
			class="text-sm text-gray-600 dark:text-gray-300"
		>
			{UI.SETTINGS_PAGE.API_KEY_LABEL}
		</label>
		<input
			id="api-key-{provider.id}"
			type="password"
			data-testid="api-key-input"
			placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
			autocomplete="off"
			class={inputClass}
			bind:value={apiKey}
		/>
	</div>

	<div class="flex flex-col gap-1.5">
		<label
			for="model-{provider.id}"
			class="text-sm text-gray-600 dark:text-gray-300"
		>
			{UI.SETTINGS_PAGE.MODEL_LABEL}
		</label>
		<select
			id="model-{provider.id}"
			data-testid="model-select"
			class={inputClass}
			bind:value={selectedModel}
		>
			{#each provider.models as model (model)}
				<option value={model}>{model}</option>
			{/each}
		</select>
	</div>

	<footer class="flex items-center gap-2 mt-1">
		<button
			type="button"
			data-testid="save-button"
			onclick={handleSave}
			disabled={!isDirty}
			class="px-4 py-2 rounded-md text-sm font-medium transition {isDirty
				? 'bg-blue-600 hover:bg-blue-700 text-white'
				: 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'}"
		>
			{UI.SETTINGS_PAGE.BUTTON_SAVE}
		</button>
		{#if isCustom && ondelete}
			<button
				type="button"
				data-testid="delete-button"
				onclick={handleDelete}
				class="px-4 py-2 rounded-md text-sm font-medium bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 transition"
			>
				{UI.SETTINGS_PAGE.BUTTON_DELETE}
			</button>
		{/if}
	</footer>
</article>
