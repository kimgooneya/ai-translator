<script lang="ts">
	import { UI } from "$lib/constants/ui-strings";
	import type { Provider, ProviderConfig } from "$lib/schemas";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import Plus from "@lucide/svelte/icons/plus";

	let {
		providers,
		configs,
		activeProviderId,
		selectedId,
		onselect,
		onSetActive,
		onnew,
	}: {
		providers: Provider[];
		configs: ProviderConfig[];
		activeProviderId: string | null;
		selectedId: string | null;
		onselect: (providerId: string) => void;
		onSetActive: (providerId: string) => void;
		onnew: () => void;
	} = $props();

	function getConfig(providerId: string): ProviderConfig | undefined {
		return configs.find((c) => c.providerId === providerId);
	}

	function hasApiKey(providerId: string): boolean {
		return (getConfig(providerId)?.apiKey ?? "").trim() !== "";
	}

	function kindLabel(provider: Provider): string {
		return provider.kind === "preset"
			? UI.SETTINGS_PAGE.KIND_PRESET
			: UI.SETTINGS_PAGE.KIND_CUSTOM;
	}

	function apiKeyLabel(providerId: string): string {
		return hasApiKey(providerId)
			? UI.SETTINGS_PAGE.API_KEY_SET
			: UI.SETTINGS_PAGE.API_KEY_EMPTY;
	}
</script>

<div
	data-testid="provider-list"
	class="flex h-full flex-col gap-3 border rounded-lg bg-card p-4 text-card-foreground"
>
	<h2 class="text-lg font-semibold text-foreground">
		{UI.SETTINGS_PAGE.LIST_TITLE}
	</h2>

	<div class="flex-1 overflow-y-auto -mx-1 px-1">
		{#if providers.length === 0}
			<p
				data-testid="provider-list-empty"
				class="py-8 text-center text-sm text-muted-foreground"
			>
				{UI.SETTINGS_PAGE.NO_PROVIDERS}
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each providers as provider (provider.id)}
					{@const isSelected = provider.id === selectedId}
					{@const isActive = provider.id === activeProviderId}
					<li>
						<div
							data-testid="provider-item"
							data-provider-id={provider.id}
							role="button"
							tabindex="0"
							onclick={() => onselect(provider.id)}
							onkeydown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onselect(provider.id);
								}
							}}
							class="flex cursor-pointer flex-col gap-2 rounded-md border p-3 transition-colors {isSelected
								? 'border-primary bg-accent ring-1 ring-primary/30'
								: 'border-border hover:bg-muted/50'}"
						>
							<div class="flex items-center justify-between gap-2">
								<span class="truncate font-medium text-foreground"
									>{provider.name}</span
								>
								<Badge variant="outline">{kindLabel(provider)}</Badge>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<Badge
									variant={hasApiKey(provider.id) ? "default" : "secondary"}
								>
									{apiKeyLabel(provider.id)}
								</Badge>
								{#if isActive}
									<Badge data-testid="active-badge" variant="default">
										{UI.SETTINGS_PAGE.BADGE_ACTIVE}
									</Badge>
								{:else}
									<Button
										data-testid="set-active-button"
										variant="ghost"
										size="sm"
										class="h-6 px-2 text-xs"
										onclick={(e) => {
											e.stopPropagation();
											onSetActive(provider.id);
										}}
									>
										{UI.SETTINGS_PAGE.ACTION_SET_ACTIVE}
									</Button>
								{/if}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<Button
		data-testid="new-provider-button"
		class="w-full"
		onclick={() => onnew()}
	>
		<Plus class="size-4" />
		{UI.SETTINGS_PAGE.BUTTON_NEW_PROVIDER}
	</Button>
</div>
