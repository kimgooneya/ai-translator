<script lang="ts">
	import { untrack } from 'svelte';
	import { UI } from '$lib/constants/ui-strings';
	import type { GlossaryEntry } from '$lib/schemas';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let {
		onsubmit,
		initial,
		oncancel
	}: {
		onsubmit: (entry: GlossaryEntry) => void;
		initial?: GlossaryEntry;
		oncancel?: () => void;
	} = $props();

	let isEdit = $derived(initial !== undefined);

	// Local editable state — intentionally initialized from `initial` once
	// (uncontrolled form). The isEdit derived re-reads `initial` reactively.
	let source = $state(untrack(() => initial?.source ?? ''));
	let target = $state(untrack(() => initial?.target ?? ''));
	let note = $state(untrack(() => initial?.note ?? ''));

	type ErrorMap = { source?: string; target?: string };
	let errors = $state<ErrorMap>({});

	function validate(): boolean {
		const next: ErrorMap = {};
		if (source.trim() === '') {
			next.source = '원본 용어를 입력하세요.';
		}
		if (target.trim() === '') {
			next.target = '번역 용어를 입력하세요.';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	function handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		if (!validate()) return;
		const trimmedNote = note.trim();
		const entry: GlossaryEntry = {
			id: initial?.id ?? '',
			source: source.trim(),
			target: target.trim(),
			...(trimmedNote !== '' ? { note: trimmedNote } : {})
		};
		onsubmit(entry);
		if (!isEdit) {
			source = '';
			target = '';
			note = '';
			errors = {};
		}
	}
</script>

<form
	data-testid="glossary-form"
	data-mode={isEdit ? 'edit' : 'add'}
	onsubmit={handleSubmit}
	novalidate
>
	<Card.Root>
		<Card.Content class="flex flex-col gap-4 pt-6">
			<div class="grid gap-2">
				<Label for="glossary-source-{isEdit ? 'edit' : 'add'}">
					{UI.GLOSSARY_PAGE.COLUMN_SOURCE}
				</Label>
				<Input
					id="glossary-source-{isEdit ? 'edit' : 'add'}"
					type="text"
					data-testid="glossary-source-input"
					placeholder={UI.GLOSSARY_PAGE.ENTRY_SOURCE_PLACEHOLDER}
					autocomplete="off"
					aria-invalid={errors.source ? 'true' : undefined}
					bind:value={source}
				/>
				{#if errors.source}
					<p data-testid="error-source" class="text-xs text-destructive">{errors.source}</p>
				{/if}
			</div>

			<div class="grid gap-2">
				<Label for="glossary-target-{isEdit ? 'edit' : 'add'}">
					{UI.GLOSSARY_PAGE.COLUMN_TARGET}
				</Label>
				<Input
					id="glossary-target-{isEdit ? 'edit' : 'add'}"
					type="text"
					data-testid="glossary-target-input"
					placeholder={UI.GLOSSARY_PAGE.ENTRY_TARGET_PLACEHOLDER}
					autocomplete="off"
					aria-invalid={errors.target ? 'true' : undefined}
					bind:value={target}
				/>
				{#if errors.target}
					<p data-testid="error-target" class="text-xs text-destructive">{errors.target}</p>
				{/if}
			</div>

			<div class="grid gap-2">
				<Label for="glossary-note-{isEdit ? 'edit' : 'add'}">
					{UI.GLOSSARY_PAGE.COLUMN_NOTE}
				</Label>
				<Input
					id="glossary-note-{isEdit ? 'edit' : 'add'}"
					type="text"
					data-testid="glossary-note-input"
					placeholder={UI.GLOSSARY_PAGE.ENTRY_NOTE_PLACEHOLDER}
					autocomplete="off"
					bind:value={note}
				/>
			</div>
		</Card.Content>

		<Separator />

		<Card.Footer class="gap-2">
			<Button type="submit" data-testid="glossary-submit-button">
				{isEdit ? UI.GLOSSARY_PAGE.BUTTON_EDIT : UI.GLOSSARY_PAGE.BUTTON_ADD}
			</Button>
			{#if isEdit && oncancel}
				<Button
					type="button"
					variant="outline"
					data-testid="glossary-cancel-button"
					onclick={() => oncancel?.()}
				>
					취소
				</Button>
			{/if}
		</Card.Footer>
	</Card.Root>
</form>
