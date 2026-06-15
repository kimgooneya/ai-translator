<script lang="ts">
	import { untrack } from 'svelte';
	import { UI } from '$lib/constants/ui-strings';
	import type { GlossaryEntry } from '$lib/schemas';

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

	const inputClass =
		'w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 ' +
		'text-gray-800 dark:text-gray-100 focus:ring-2 focus:border-transparent outline-none transition ' +
		'border-gray-300 dark:border-gray-600 focus:ring-blue-500';
	const errorInputClass =
		'w-full px-3 py-2 rounded-md border bg-white dark:bg-gray-700 ' +
		'text-gray-800 dark:text-gray-100 focus:ring-2 focus:border-transparent outline-none transition ' +
		'border-red-400 dark:border-red-500 focus:ring-red-500';

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
	class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3"
	novalidate
>
	<div class="flex flex-col gap-1.5">
		<label for="glossary-source-{isEdit ? 'edit' : 'add'}" class="text-sm text-gray-600 dark:text-gray-300">
			{UI.GLOSSARY_PAGE.COLUMN_SOURCE}
		</label>
		<input
			id="glossary-source-{isEdit ? 'edit' : 'add'}"
			type="text"
			data-testid="glossary-source-input"
			placeholder={UI.GLOSSARY_PAGE.ENTRY_SOURCE_PLACEHOLDER}
			autocomplete="off"
			class={errors.source ? errorInputClass : inputClass}
			bind:value={source}
		/>
		{#if errors.source}
			<p data-testid="error-source" class="text-xs text-red-600 dark:text-red-400">{errors.source}</p>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="glossary-target-{isEdit ? 'edit' : 'add'}" class="text-sm text-gray-600 dark:text-gray-300">
			{UI.GLOSSARY_PAGE.COLUMN_TARGET}
		</label>
		<input
			id="glossary-target-{isEdit ? 'edit' : 'add'}"
			type="text"
			data-testid="glossary-target-input"
			placeholder={UI.GLOSSARY_PAGE.ENTRY_TARGET_PLACEHOLDER}
			autocomplete="off"
			class={errors.target ? errorInputClass : inputClass}
			bind:value={target}
		/>
		{#if errors.target}
			<p data-testid="error-target" class="text-xs text-red-600 dark:text-red-400">{errors.target}</p>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<label for="glossary-note-{isEdit ? 'edit' : 'add'}" class="text-sm text-gray-600 dark:text-gray-300">
			{UI.GLOSSARY_PAGE.COLUMN_NOTE}
		</label>
		<input
			id="glossary-note-{isEdit ? 'edit' : 'add'}"
			type="text"
			data-testid="glossary-note-input"
			placeholder={UI.GLOSSARY_PAGE.ENTRY_NOTE_PLACEHOLDER}
			autocomplete="off"
			class={inputClass}
			bind:value={note}
		/>
	</div>

	<div class="flex items-center gap-2">
		<button
			type="submit"
			data-testid="glossary-submit-button"
			class="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition"
		>
			{isEdit ? UI.GLOSSARY_PAGE.BUTTON_EDIT : UI.GLOSSARY_PAGE.BUTTON_ADD}
		</button>
		{#if isEdit && oncancel}
			<button
				type="button"
				data-testid="glossary-cancel-button"
				onclick={() => oncancel?.()}
				class="px-4 py-2 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
			>
				취소
			</button>
		{/if}
	</div>
</form>
