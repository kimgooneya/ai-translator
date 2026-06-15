<script lang="ts">
	import {
		glossaryStore,
		addEntry,
		updateEntry,
		removeEntry,
		toggleEnabled,
		generateEntryId
	} from '$lib/stores/glossary';
	import { UI } from '$lib/constants/ui-strings';
	import type { GlossaryEntry } from '$lib/schemas';
	import GlossaryForm from '$lib/components/GlossaryForm.svelte';
	import GlossaryEntryRow from '$lib/components/GlossaryEntryRow.svelte';

	let glossary = $derived($glossaryStore);
	let editingId = $state<string | null>(null);

	let editingEntry = $derived(
		editingId === null
			? undefined
			: glossary.entries.find((e) => e.id === editingId)
	);

	function handleAdd(entry: GlossaryEntry): void {
		addEntry({ ...entry, id: generateEntryId() });
	}

	function handleEditSubmit(entry: GlossaryEntry): void {
		if (editingId === null) return;
		updateEntry(editingId, {
			source: entry.source,
			target: entry.target,
			...(entry.note !== undefined ? { note: entry.note } : {})
		});
		editingId = '';
	}

	function handleDelete(id: string): void {
		if (confirm('정말 삭제하시겠습니까?')) {
			removeEntry(id);
		}
	}

	function cancelEdit(): void {
		editingId = '';
	}
</script>

<svelte:head>
	<title>{UI.GLOSSARY_PAGE.TITLE} – {UI.APP_TITLE}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">
			{UI.GLOSSARY_PAGE.TITLE}
		</h1>
		<label
			for="glossary-enabled-toggle"
			class="flex items-center gap-2 cursor-pointer select-none"
		>
			<input
				id="glossary-enabled-toggle"
				type="checkbox"
				data-testid="glossary-toggle"
				class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
				checked={glossary.enabled}
				onchange={() => toggleEnabled()}
			/>
			<span class="text-sm text-gray-700 dark:text-gray-200">
				{UI.GLOSSARY_PAGE.TOGGLE_LABEL}
			</span>
		</label>
	</header>

	<section class="flex flex-col gap-3">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-700 dark:text-gray-200">
				{UI.GLOSSARY_PAGE.ENTRY_COUNT(glossary.entries.length)}
			</h2>
		</div>

		<GlossaryForm onsubmit={handleAdd} />

		{#if glossary.entries.length === 0}
			<p
				data-testid="glossary-empty-message"
				class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-md p-4 text-center"
			>
				{UI.GLOSSARY_PAGE.EMPTY_MESSAGE}
			</p>
		{:else}
			<div class="flex flex-col gap-3">
				{#each glossary.entries as entry (entry.id)}
					{#if editingId === entry.id && editingEntry}
						<GlossaryForm
							initial={editingEntry}
							onsubmit={handleEditSubmit}
							oncancel={cancelEdit}
						/>
					{:else}
						<GlossaryEntryRow
							{entry}
							onedit={(id) => (editingId = id)}
							ondelete={handleDelete}
						/>
					{/if}
				{/each}
			</div>
		{/if}
	</section>
</div>
