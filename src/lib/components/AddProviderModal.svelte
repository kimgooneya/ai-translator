<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		onsave
	}: {
		onsave: (data: {
			name: string;
			baseURL: string;
			models: string[];
			defaultModel: string;
		}) => void;
	} = $props();

	let open = $state(false);

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
			next.name = UI.SETTINGS_PAGE.ERROR_NAME_REQUIRED;
		}
		if (baseURL.trim() === '') {
			next.baseURL = UI.SETTINGS_PAGE.ERROR_BASE_URL_REQUIRED;
		} else if (!isValidUrl(baseURL.trim())) {
			next.baseURL = UI.SETTINGS_PAGE.ERROR_BASE_URL_INVALID;
		}
		if (models.length === 0) {
			next.models = UI.SETTINGS_PAGE.ERROR_MODELS_REQUIRED;
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
		onsave({
			name: name.trim(),
			baseURL: baseURL.trim(),
			models: [...models],
			defaultModel
		});
		resetForm();
		open = false;
	}

	let defaultModelTriggerText = $derived(
		models.length === 0
			? UI.SETTINGS_PAGE.DEFAULT_MODEL_PLACEHOLDER
			: (defaultModel || UI.SETTINGS_PAGE.DEFAULT_MODEL_PLACEHOLDER)
	);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger data-testid="add-provider-button">
		<Button>{UI.SETTINGS_PAGE.BUTTON_ADD_PROVIDER}</Button>
	</Dialog.Trigger>
	<Dialog.Content data-testid="add-provider-modal">
		<Dialog.Header>
			<Dialog.Title>{UI.SETTINGS_PAGE.ADD_PROVIDER_TITLE}</Dialog.Title>
		</Dialog.Header>
		<form onsubmit={handleSubmit} novalidate>
			<div class="flex flex-col gap-4 py-4">
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
			</div>

			<Dialog.Footer>
				<Button type="submit" data-testid="add-submit-button">
					{UI.SETTINGS_PAGE.BUTTON_ADD}
				</Button>
				<Button
					type="button"
					variant="outline"
					data-testid="add-cancel-button"
					onclick={() => (open = false)}
				>
					{UI.SETTINGS_PAGE.BUTTON_CANCEL}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
