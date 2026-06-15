<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';

	let {
		onadd
	}: {
		onadd: (provider: Provider, config: ProviderConfig) => void;
	} = $props();

	let name = $state('');
	let baseURL = $state('');
	let modelsInput = $state('');
	let defaultModel = $state('');

	let models = $derived(
		modelsInput
			.split(',')
			.map((m) => m.trim())
			.filter((m) => m !== '')
	);

	// Keep defaultModel valid as the user edits the models list.
	let lastModelsKey = $state('');
	$effect(() => {
		const key = models.join('|');
		if (key !== lastModelsKey) {
			lastModelsKey = key;
			if (models.length === 0) {
				defaultModel = '';
			} else if (!models.includes(defaultModel)) {
				defaultModel = models[0];
			}
		}
	});

	type ErrorMap = { name?: string; baseURL?: string; models?: string };
	let errors = $state<ErrorMap>({});

	const inputClass =
		'w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 ' +
		'text-gray-800 dark:text-gray-100 focus:ring-2 focus:border-transparent outline-none transition ' +
		'border-gray-300 dark:border-gray-600 focus:ring-blue-500';
	const errorInputClass =
		'w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 ' +
		'text-gray-800 dark:text-gray-100 focus:ring-2 focus:border-transparent outline-none transition ' +
		'border-red-400 dark:border-red-500 focus:ring-red-500';

	function isValidUrl(value: string): boolean {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	function validate(): boolean {
		const next: ErrorMap = {};
		if (name.trim() === '') {
			next.name = '이름을 입력하세요.';
		}
		if (baseURL.trim() === '') {
			next.baseURL = 'Base URL을 입력하세요.';
		} else if (!isValidUrl(baseURL.trim())) {
			next.baseURL = '올바른 URL 형식이 아닙니다. (예: https://api.example.com/v1)';
		}
		if (models.length === 0) {
			next.models = '최소 한 개의 모델을 입력하세요.';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	function resetForm(): void {
		name = '';
		baseURL = '';
		modelsInput = '';
		defaultModel = '';
		errors = {};
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		if (!validate()) return;
		const trimmedName = name.trim();
		const trimmedBaseURL = baseURL.trim();
		const provider: Provider = {
			id: trimmedName,
			name: trimmedName,
			kind: 'custom',
			baseURL: trimmedBaseURL,
			models: [...models],
			defaultModel
		};
		const config: ProviderConfig = {
			providerId: trimmedName,
			apiKey: '',
			selectedModel: defaultModel,
			baseURL: trimmedBaseURL
		};
		onadd(provider, config);
		resetForm();
	}
</script>

<section
	data-testid="add-provider-form"
	class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3"
>
	<h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">
		{UI.SETTINGS_PAGE.ADD_PROVIDER_TITLE}
	</h3>

	<form onsubmit={handleSubmit} class="flex flex-col gap-3" novalidate>
		<div class="flex flex-col gap-1.5">
			<label for="add-name" class="text-sm text-gray-600 dark:text-gray-300">
				{UI.SETTINGS_PAGE.PROVIDER_NAME}
			</label>
			<input
				id="add-name"
				type="text"
				data-testid="add-name-input"
				class={errors.name ? errorInputClass : inputClass}
				bind:value={name}
			/>
			{#if errors.name}
				<p data-testid="error-name" class="text-xs text-red-600 dark:text-red-400">{errors.name}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="add-base-url" class="text-sm text-gray-600 dark:text-gray-300">
				{UI.SETTINGS_PAGE.PROVIDER_BASE_URL}
			</label>
			<input
				id="add-base-url"
				type="url"
				placeholder="https://api.example.com/v1"
				data-testid="add-base-url-input"
				class={errors.baseURL ? errorInputClass : inputClass}
				bind:value={baseURL}
			/>
			{#if errors.baseURL}
				<p data-testid="error-base-url" class="text-xs text-red-600 dark:text-red-400">{errors.baseURL}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="add-models" class="text-sm text-gray-600 dark:text-gray-300">
				{UI.SETTINGS_PAGE.PROVIDER_MODELS}
			</label>
			<input
				id="add-models"
				type="text"
				placeholder="model-1, model-2"
				data-testid="add-models-input"
				class={errors.models ? errorInputClass : inputClass}
				bind:value={modelsInput}
			/>
			{#if errors.models}
				<p data-testid="error-models" class="text-xs text-red-600 dark:text-red-400">{errors.models}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1.5">
			<label for="add-default-model" class="text-sm text-gray-600 dark:text-gray-300">
				{UI.SETTINGS_PAGE.PROVIDER_DEFAULT_MODEL}
			</label>
			<select
				id="add-default-model"
				data-testid="add-default-model-select"
				class={inputClass}
				bind:value={defaultModel}
			>
				{#if models.length === 0}
					<option value="" disabled>먼저 모델을 입력하세요</option>
				{:else}
					{#each models as model (model)}
						<option value={model}>{model}</option>
					{/each}
				{/if}
			</select>
		</div>

		<button
			type="submit"
			data-testid="add-submit-button"
			class="self-start px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition"
		>
			{UI.SETTINGS_PAGE.BUTTON_ADD}
		</button>
	</form>
</section>
