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
	import ProviderCard from '$lib/components/ProviderCard.svelte';
	import AddProviderForm from '$lib/components/AddProviderForm.svelte';

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

	function getConfigForPreset(presetId: string): ProviderConfig | undefined {
		return settings.providers.find((c) => c.providerId === presetId);
	}

	function handleSave(config: ProviderConfig): void {
		const wasEmpty = settings.providers.length === 0;
		upsertProviderConfig(config);
		if (wasEmpty) {
			setActiveProvider(config.providerId);
		}
	}

	function handleAdd(_provider: Provider, config: ProviderConfig): void {
		const wasEmpty = settings.providers.length === 0;
		upsertProviderConfig(config);
		if (wasEmpty) {
			setActiveProvider(config.providerId);
		}
	}

	function handleDelete(providerId: string): void {
		if (confirm('정말 삭제하시겠습니까?')) {
			removeProviderConfig(providerId);
		}
	}
</script>

<svelte:head>
	<title>{UI.SETTINGS_PAGE.TITLE} – {UI.APP_TITLE}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header>
		<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
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
		<h2 class="text-lg font-semibold text-gray-700 dark:text-gray-200">Provider</h2>
		<div class="grid gap-4 sm:grid-cols-2">
			{#each PRESET_PROVIDERS as preset (preset.id)}
				<ProviderCard
					provider={preset}
					config={getConfigForPreset(preset.id)}
					onsave={handleSave}
				/>
			{/each}
			{#each customEntries as entry (entry.provider.id)}
				<ProviderCard
					provider={entry.provider}
					config={entry.config}
					onsave={handleSave}
					ondelete={() => handleDelete(entry.provider.id)}
				/>
			{/each}
		</div>
	</section>

	<AddProviderForm onadd={handleAdd} />
</div>
