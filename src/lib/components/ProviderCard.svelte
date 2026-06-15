<script lang="ts">
	import { untrack } from 'svelte';
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';

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

	const apiKeyId = `api-key-${provider.id}`;
	const modelId = `model-${provider.id}`;

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

<Card.Root data-testid="provider-card" data-provider-id={provider.id}>
	<Card.Header>
		<Card.Title class="text-base">{provider.name}</Card.Title>
		<Card.Action>
			<Badge variant={hasApiKey ? 'default' : 'secondary'}>
				{hasApiKey ? UI.SETTINGS_PAGE.API_KEY_SET : UI.SETTINGS_PAGE.API_KEY_EMPTY}
			</Badge>
		</Card.Action>
	</Card.Header>

	<Card.Content class="flex flex-col gap-4">
		<div class="flex flex-col gap-1.5">
			<Label for={apiKeyId}>{UI.SETTINGS_PAGE.API_KEY_LABEL}</Label>
			<Input
				id={apiKeyId}
				type="password"
				data-testid="api-key-input"
				placeholder={UI.SETTINGS_PAGE.API_KEY_PLACEHOLDER}
				autocomplete="off"
				bind:value={apiKey}
			/>
		</div>

		<div class="flex flex-col gap-1.5">
			<Label for={modelId}>{UI.SETTINGS_PAGE.MODEL_LABEL}</Label>
			<Select.Root type="single" bind:value={selectedModel}>
				<Select.Trigger data-testid="model-select" id={modelId} class="w-full">
					{selectedModel}
				</Select.Trigger>
				<Select.Content>
					{#each provider.models as model (model)}
						<Select.Item value={model} label={model}>{model}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</Card.Content>

	<Card.Footer class="gap-2">
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
	</Card.Footer>
</Card.Root>
