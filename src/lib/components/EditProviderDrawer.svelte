<script lang="ts">
	import { untrack } from 'svelte';
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';

	let {
		open = $bindable(),
		provider,
		config,
		onsave,
		ondelete
	}: {
		open: boolean;
		provider: Provider;
		config: ProviderConfig | undefined;
		onsave: (config: ProviderConfig) => void;
		ondelete?: () => void;
	} = $props();

	let apiKey = $state(untrack(() => config?.apiKey ?? ''));
	let selectedModel = $state(untrack(() => config?.selectedModel ?? provider.defaultModel));

	let isDirty = $derived(
		apiKey !== (config?.apiKey ?? '') ||
			selectedModel !== (config?.selectedModel ?? provider.defaultModel)
	);

	let isCustom = $derived(provider.kind === 'custom');

	function handleSave(): void {
		const next: ProviderConfig = {
			providerId: provider.id,
			apiKey: apiKey.trim(),
			selectedModel,
			...(isCustom ? { baseURL: provider.baseURL } : {})
		};
		onsave(next);
		open = false;
	}

	function handleDelete(): void {
		if (confirm(UI.SETTINGS_PAGE.CONFIRM_DELETE)) {
			ondelete?.();
			open = false;
		}
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="right" data-testid="edit-provider-drawer">
		<Sheet.Header>
			<Sheet.Title>{UI.SETTINGS_PAGE.EDIT_PROVIDER_TITLE}: {provider.name}</Sheet.Title>
		</Sheet.Header>

		<div class="flex flex-col gap-4 p-4">
			<div class="flex flex-col gap-1.5">
				<Label for="edit-api-key">{UI.SETTINGS_PAGE.API_KEY_LABEL}</Label>
				<Input
					id="edit-api-key"
					type="password"
					data-testid="api-key-input"
					placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
					autocomplete="off"
					bind:value={apiKey}
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="edit-model">{UI.SETTINGS_PAGE.MODEL_LABEL}</Label>
				<Select.Root type="single" bind:value={selectedModel}>
					<Select.Trigger id="edit-model" data-testid="model-select" class="w-full">
						{selectedModel}
					</Select.Trigger>
					<Select.Content>
						{#each provider.models as model (model)}
							<Select.Item value={model} label={model}>{model}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>

			{#if isCustom}
				<div class="flex flex-col gap-1.5">
					<Label for="edit-base-url">{UI.SETTINGS_PAGE.PROVIDER_BASE_URL}</Label>
					<Input
						id="edit-base-url"
						type="url"
						data-testid="base-url-input"
						value={provider.baseURL}
						readonly
					/>
				</div>
			{/if}

			<Sheet.Footer class="flex-row gap-2">
				<Button data-testid="save-button" disabled={!isDirty} onclick={handleSave}>
					{UI.SETTINGS_PAGE.BUTTON_SAVE}
				</Button>
				{#if isCustom && ondelete}
					<Button
						variant="destructive"
						data-testid="delete-button"
						onclick={handleDelete}
					>
						{UI.SETTINGS_PAGE.BUTTON_DELETE}
					</Button>
				{/if}
			</Sheet.Footer>
		</div>
	</Sheet.Content>
</Sheet.Root>
