<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';
	import Label from '$lib/components/ui/label/label.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	let {
		expanded = $bindable(),
		customPrompt = $bindable(),
		glossaryEnabled,
		glossaryCount,
		onToggleGlossary
	}: {
		expanded: boolean;
		customPrompt: string;
		glossaryEnabled: boolean;
		glossaryCount: number;
		onToggleGlossary: () => void;
	} = $props();
</script>

<section data-testid="advanced-options" class="flex flex-col gap-3">
	<Collapsible.Root bind:open={expanded}>
		<Collapsible.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					data-testid="advanced-options-toggle"
					variant="ghost"
					class="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground justify-start"
				>
					<svg
						class="size-4 transition-transform {expanded ? 'rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
					{UI.TRANSLATE_PAGE.ADVANCED_OPTIONS}
				</Button>
			{/snippet}
		</Collapsible.Trigger>

		<Collapsible.Content>
			<div data-testid="advanced-options-content" class="flex flex-col gap-4 pl-6 pt-3">
				<div class="flex flex-col gap-1.5">
					<Label for="custom-prompt" class="text-muted-foreground">
						{UI.TRANSLATE_PAGE.LABEL_CUSTOM_PROMPT}
					</Label>
					<Textarea
						id="custom-prompt"
						data-testid="custom-prompt-input"
						placeholder={UI.TRANSLATE_PAGE.PLACEHOLDER_CUSTOM_PROMPT}
						rows={3}
						bind:value={customPrompt}
					/>
				</div>

				<div class="flex items-center gap-3">
					<Switch
						id="glossary-toggle"
						data-testid="glossary-toggle"
						checked={glossaryEnabled}
						onCheckedChange={onToggleGlossary}
					/>
					<Label for="glossary-toggle" class="text-muted-foreground cursor-pointer select-none">
						{UI.TRANSLATE_PAGE.LABEL_GLOSSARY_TOGGLE}
						<span class="text-muted-foreground/70">
							({glossaryCount}개 용어)
						</span>
					</Label>
				</div>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
</section>
