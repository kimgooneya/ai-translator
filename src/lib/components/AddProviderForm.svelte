<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

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

	const defaultModelTriggerText = $derived(
		models.length === 0 ? '먼저 모델을 입력하세요' : (defaultModel || '먼저 모델을 입력하세요')
	);
</script>

<section data-testid="add-provider-form">
	<Card.Root>
		<Card.Header>
			<Card.Title>{UI.SETTINGS_PAGE.ADD_PROVIDER_TITLE}</Card.Title>
		</Card.Header>
		<form onsubmit={handleSubmit} novalidate>
			<Card.Content class="flex flex-col gap-4">
				<div class="grid gap-2">
					<Label for="add-name">{UI.SETTINGS_PAGE.PROVIDER_NAME}</Label>
					<Input
						id="add-name"
						type="text"
						data-testid="add-name-input"
						aria-invalid={errors.name ? 'true' : undefined}
						bind:value={name}
					/>
					{#if errors.name}
						<p data-testid="error-name" class="text-xs text-destructive">{errors.name}</p>
					{/if}
				</div>

				<div class="grid gap-2">
					<Label for="add-base-url">{UI.SETTINGS_PAGE.PROVIDER_BASE_URL}</Label>
					<Input
						id="add-base-url"
						type="url"
						placeholder="https://api.example.com/v1"
						data-testid="add-base-url-input"
						aria-invalid={errors.baseURL ? 'true' : undefined}
						bind:value={baseURL}
					/>
					{#if errors.baseURL}
						<p data-testid="error-base-url" class="text-xs text-destructive">
							{errors.baseURL}
						</p>
					{/if}
				</div>

				<div class="grid gap-2">
					<Label for="add-models">{UI.SETTINGS_PAGE.PROVIDER_MODELS}</Label>
					<Input
						id="add-models"
						type="text"
						placeholder="model-1, model-2"
						data-testid="add-models-input"
						aria-invalid={errors.models ? 'true' : undefined}
						bind:value={modelsInput}
					/>
					{#if errors.models}
						<p data-testid="error-models" class="text-xs text-destructive">{errors.models}</p>
					{/if}
				</div>

				<div class="grid gap-2">
					<Label for="add-default-model">{UI.SETTINGS_PAGE.PROVIDER_DEFAULT_MODEL}</Label>
					<Select.Root type="single" bind:value={defaultModel}>
						<Select.Trigger
							id="add-default-model"
							data-testid="add-default-model-select"
							class="w-full"
						>
							{defaultModelTriggerText}
						</Select.Trigger>
						{#if models.length > 0}
							<Select.Content>
								{#each models as model (model)}
									<Select.Item value={model} label={model}>{model}</Select.Item>
								{/each}
							</Select.Content>
						{/if}
					</Select.Root>
				</div>
			</Card.Content>
			<Card.Footer>
				<Button type="submit" data-testid="add-submit-button">
					{UI.SETTINGS_PAGE.BUTTON_ADD}
				</Button>
			</Card.Footer>
		</form>
	</Card.Root>
</section>
