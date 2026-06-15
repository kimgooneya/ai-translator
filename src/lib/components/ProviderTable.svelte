<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { Provider, ProviderConfig } from '$lib/schemas';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		providers,
		configs,
		activeProviderId,
		onEdit,
		onSetActive
	}: {
		providers: Provider[];
		configs: ProviderConfig[];
		activeProviderId: string | null;
		onEdit: (providerId: string) => void;
		onSetActive: (providerId: string) => void;
	} = $props();

	function getConfig(providerId: string): ProviderConfig | undefined {
		return configs.find((c) => c.providerId === providerId);
	}

	function hasApiKey(providerId: string): boolean {
		return (getConfig(providerId)?.apiKey ?? '').trim() !== '';
	}

	function kindLabel(provider: Provider): string {
		return provider.kind === 'preset'
			? UI.SETTINGS_PAGE.KIND_PRESET
			: UI.SETTINGS_PAGE.KIND_CUSTOM;
	}

	function apiKeyLabel(providerId: string): string {
		return hasApiKey(providerId)
			? UI.SETTINGS_PAGE.API_KEY_SET
			: UI.SETTINGS_PAGE.API_KEY_EMPTY;
	}
</script>

<div data-testid="provider-table" class="flex flex-col gap-2">
	<div class="relative w-full overflow-auto hidden sm:block" data-testid="provider-table-desktop">
		<table class="w-full caption-bottom text-sm">
			<thead class="[&_tr]:border-b">
				<tr>
					<th class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">{UI.SETTINGS_PAGE.COL_PROVIDER}</th>
					<th class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">{UI.SETTINGS_PAGE.COL_KIND}</th>
					<th class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">{UI.SETTINGS_PAGE.COL_API_KEY}</th>
					<th class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">{UI.SETTINGS_PAGE.COL_MODEL}</th>
					<th class="text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap">{UI.SETTINGS_PAGE.COL_ACTIONS}</th>
				</tr>
			</thead>
			<tbody class="[&_tr:last-child]:border-0">
				{#each providers as provider (provider.id)}
					{@const active = provider.id === activeProviderId}
					{@const config = getConfig(provider.id)}
					<tr
						data-testid="provider-row"
						data-provider-id={provider.id}
						class="hover:bg-muted/50 border-b transition-colors"
					>
						<td class="p-2 align-middle whitespace-nowrap font-medium">{provider.name}</td>
						<td class="p-2 align-middle whitespace-nowrap">
							<Badge variant="outline">{kindLabel(provider)}</Badge>
						</td>
						<td class="p-2 align-middle whitespace-nowrap">
							<Badge variant={hasApiKey(provider.id) ? 'default' : 'secondary'}>
								{apiKeyLabel(provider.id)}
							</Badge>
						</td>
						<td class="p-2 align-middle whitespace-nowrap text-muted-foreground">
							{config?.selectedModel ?? provider.defaultModel}
						</td>
						<td class="p-2 align-middle whitespace-nowrap">
							<div class="flex items-center gap-2">
								{#if active}
									<Badge data-testid="active-badge" variant="default">
										{UI.SETTINGS_PAGE.BADGE_ACTIVE}
									</Badge>
								{:else}
									<Button
										data-testid="set-active-button"
										variant="ghost"
										size="sm"
										onclick={() => onSetActive(provider.id)}
									>
										{UI.SETTINGS_PAGE.ACTION_SET_ACTIVE}
									</Button>
								{/if}
								<Button
									data-testid="edit-button"
									variant="ghost"
									size="sm"
									onclick={() => onEdit(provider.id)}
								>
									{UI.SETTINGS_PAGE.ACTION_EDIT}
								</Button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="flex flex-col gap-3 sm:hidden" data-testid="provider-table-mobile">
		{#each providers as provider (provider.id)}
			{@const active = provider.id === activeProviderId}
			{@const config = getConfig(provider.id)}
			<div
				data-testid="provider-card-mobile"
				data-provider-id={provider.id}
				class="border rounded-lg p-4 flex flex-col gap-2"
			>
				<div class="flex items-center justify-between">
					<span class="font-medium">{provider.name}</span>
					{#if active}
						<Badge data-testid="active-badge" variant="default">
							{UI.SETTINGS_PAGE.BADGE_ACTIVE}
						</Badge>
					{/if}
				</div>
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<Badge variant="outline">{kindLabel(provider)}</Badge>
					<Badge variant={hasApiKey(provider.id) ? 'default' : 'secondary'}>
						{apiKeyLabel(provider.id)}
					</Badge>
					<span>{config?.selectedModel ?? provider.defaultModel}</span>
				</div>
				<div class="flex items-center gap-2">
					{#if !active}
						<Button
							data-testid="set-active-button"
							variant="ghost"
							size="sm"
							onclick={() => onSetActive(provider.id)}
						>
							{UI.SETTINGS_PAGE.ACTION_SET_ACTIVE}
						</Button>
					{/if}
					<Button
						data-testid="edit-button"
						variant="ghost"
						size="sm"
						onclick={() => onEdit(provider.id)}
					>
						{UI.SETTINGS_PAGE.ACTION_EDIT}
					</Button>
				</div>
			</div>
		{/each}
	</div>
</div>
