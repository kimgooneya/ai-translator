<script lang="ts">
	import {
		settingsStore,
		upsertProviderConfig,
		removeProviderConfig,
		setActiveProvider
	} from '$lib/stores/settings';
	import { PRESET_PROVIDERS, isPresetId } from '$lib/providers/presets';
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';
	import ProviderTable from '$lib/components/ProviderTable.svelte';
	import AddProviderModal from '$lib/components/AddProviderModal.svelte';
	import EditProviderDrawer from '$lib/components/EditProviderDrawer.svelte';

	let settings = $derived($settingsStore);

	type CustomEntry = { provider: Provider; config: ProviderConfig };
	let customEntries = $derived<CustomEntry[]>(
		settings.providers
			.filter((c) => !isPresetId(c.providerId))
			.map((c) => ({
				provider: {
					id: c.providerId,
					name: c.providerId,
					kind: 'custom' as const,
					baseURL: c.baseURL ?? '',
					models: [c.selectedModel],
					defaultModel: c.selectedModel
				},
				config: c
			}))
	);

	let allProviders = $derived<Provider[]>([
		...PRESET_PROVIDERS,
		...customEntries.map((e) => e.provider)
	]);

	let drawerOpen = $state(false);
	let editingProviderId = $state<string | null>(null);

	let editingProvider = $derived(
		editingProviderId
			? (allProviders.find((p) => p.id === editingProviderId) ?? null)
			: null
	);
	let editingConfig = $derived(
		editingProviderId
			? (settings.providers.find((c) => c.providerId === editingProviderId) ?? undefined)
			: undefined
	);

	function handleEdit(providerId: string): void {
		editingProviderId = providerId;
		drawerOpen = true;
	}

	function handleSetActive(providerId: string): void {
		setActiveProvider(providerId);
	}

	function handleSaveFromDrawer(config: ProviderConfig): void {
		const wasEmpty = settings.providers.length === 0;
		upsertProviderConfig(config);
		if (wasEmpty) {
			setActiveProvider(config.providerId);
		}
	}

	function handleDeleteFromDrawer(): void {
		if (editingProviderId) {
			removeProviderConfig(editingProviderId);
		}
		drawerOpen = false;
		editingProviderId = null;
	}

	function handleAddFromModal(data: {
		name: string;
		baseURL: string;
		models: string[];
		defaultModel: string;
	}): void {
		const wasEmpty = settings.providers.length === 0;
		const config: ProviderConfig = {
			providerId: data.name,
			apiKey: '',
			selectedModel: data.defaultModel,
			baseURL: data.baseURL
		};
		upsertProviderConfig(config);
		if (wasEmpty) {
			setActiveProvider(config.providerId);
		}
	}
</script>

<svelte:head>
	<title>{UI.SETTINGS_PAGE.TITLE} – {UI.APP_TITLE}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4 text-foreground">
	<header>
		<h1 class="text-2xl font-semibold tracking-tight text-foreground">
			{UI.SETTINGS_PAGE.TITLE}
		</h1>
	</header>

	<div
		data-testid="security-notice"
		class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md p-4"
	>
		<p class="text-sm text-yellow-800 dark:text-yellow-200">
			{UI.SETTINGS_PAGE.SECURITY_NOTICE}
		</p>
	</div>

	<section data-testid="preset-providers-section" class="flex flex-col gap-3">
		<h2 class="text-lg font-semibold text-foreground">Provider</h2>
		<ProviderTable
			providers={allProviders}
			configs={settings.providers}
			activeProviderId={settings.activeProviderId}
			onEdit={handleEdit}
			onSetActive={handleSetActive}
		/>
	</section>

	<AddProviderModal onsave={handleAddFromModal} />

	{#if editingProvider}
		<EditProviderDrawer
			bind:open={drawerOpen}
			provider={editingProvider}
			config={editingConfig}
			onsave={handleSaveFromDrawer}
			ondelete={editingProvider.kind === 'custom' ? handleDeleteFromDrawer : undefined}
		/>
	{/if}
</div>
