<script lang="ts">
	import { UI } from '$lib/constants/ui-strings';
	import type { GlossaryEntry } from '$lib/schemas';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		entry,
		onedit,
		ondelete
	}: {
		entry: GlossaryEntry;
		onedit: (id: string) => void;
		ondelete: (id: string) => void;
	} = $props();
</script>

<Card.Root
	data-testid="glossary-entry-row"
	data-entry-id={entry.id}
	class="flex-row flex-wrap items-center justify-between gap-4 py-4"
>
	<div class="flex flex-col gap-1 min-w-0 flex-1 px-6">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<span
				data-testid="entry-source"
				class="text-sm font-semibold text-foreground break-all"
			>
				{entry.source}
			</span>
			<span class="text-muted-foreground" aria-hidden="true">→</span>
			<span
				data-testid="entry-target"
				class="text-sm text-muted-foreground break-all"
			>
				{entry.target}
			</span>
		</div>
		{#if entry.note}
			<p data-testid="entry-note" class="text-xs text-muted-foreground break-all">
				{entry.note}
			</p>
		{/if}
	</div>

	<div class="flex items-center gap-2 shrink-0 pr-6">
		<Button
			variant="ghost"
			size="sm"
			data-testid="edit-button"
			onclick={() => onedit(entry.id)}
		>
			{UI.GLOSSARY_PAGE.BUTTON_EDIT}
		</Button>
		<Button
			variant="destructive"
			size="sm"
			data-testid="delete-button"
			onclick={() => ondelete(entry.id)}
		>
			{UI.GLOSSARY_PAGE.BUTTON_DELETE}
		</Button>
	</div>
</Card.Root>
