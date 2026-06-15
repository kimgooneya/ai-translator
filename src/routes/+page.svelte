<script lang="ts">
	import { settingsStore } from '$lib/stores/settings';
	import { glossaryStore } from '$lib/stores/glossary';
	import { addHistoryEntry } from '$lib/stores/history';
	import { toast } from 'svelte-sonner';
	import { getProviderById } from '$lib/providers/registry';
	import { UI } from '$lib/constants/ui-strings';
	import { getErrorMessage } from '$lib/constants/error-messages';
	import { translateAction } from '$lib/streaming/translateAction';
	import { detectLanguage } from '$lib/detect/detectLanguage';
	import { languageName } from '$lib/constants/languages';
	import type { TranslationRequest, TranslationHistoryEntry } from '$lib/schemas';
	import TranslateControls from '$lib/components/TranslateControls.svelte';
	import AdvancedOptions from '$lib/components/AdvancedOptions.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	function handleToggleGlossary(): void {
		glossaryStore.update((g) => ({ ...g, enabled: !g.enabled }));
	}

	let sourceText = $state('');
	let sourceLang = $state('auto');
	let targetLang = $state('ko');
	let model = $state('');
	let customPrompt = $state('');
	let isLoading = $state(false);
	let resultText = $state('');
	let advancedExpanded = $state(false);
	let loadedFile = $state<{ name: string; content: string } | null>(null);

	let settings = $derived($settingsStore);
	let glossary = $derived($glossaryStore);

	let activeProviderConfig = $derived(
		settings.providers.find((p) => p.providerId === settings.activeProviderId)
	);

	let hasActiveProvider = $derived(settings.activeProviderId !== null);
	let hasApiKey = $derived((activeProviderConfig?.apiKey ?? '').trim() !== '');

	let activeProvider = $derived(
		settings.activeProviderId ? getProviderById(settings, settings.activeProviderId) : undefined
	);

	let availableModels = $derived(activeProvider?.models ?? []);

	let effectiveSourceText = $derived(loadedFile?.content ?? sourceText);

	let canTranslate = $derived(
		effectiveSourceText.trim() !== '' && hasApiKey && hasActiveProvider && !isLoading
	);

	let charCount = $derived(effectiveSourceText.length);

	// Detect language when sourceLang is 'auto' and effective source text is present
	let detectedLanguage = $derived(
		sourceLang === 'auto' && effectiveSourceText.trim() !== ''
			? detectLanguage(effectiveSourceText)
			: ''
	);

	// Sync local model state when the active provider or its config changes.
	let prevProviderId: string | null = null;
	$effect(() => {
		const pid = settings.activeProviderId;
		if (pid !== prevProviderId) {
			prevProviderId = pid;
			model = activeProviderConfig?.selectedModel ?? activeProvider?.defaultModel ?? '';
		}
	});

	let abortController: AbortController | null = null;

	async function handleTranslate(): Promise<void> {
		if (!canTranslate) return;

		isLoading = true;
		resultText = '';

		abortController = new AbortController();

		const providerName = activeProvider?.name ?? settings.activeProviderId ?? '';
		const modelName = model || activeProviderConfig?.selectedModel || '';

		const request: TranslationRequest = {
			sourceText: effectiveSourceText,
			sourceLang: sourceLang,
			targetLang,
			providerId: settings.activeProviderId ?? '',
			apiKey: activeProviderConfig?.apiKey ?? '',
			model: modelName,
			glossary: glossary.enabled ? glossary : undefined,
			customPrompt: customPrompt.trim() || undefined
		};

		await translateAction(
			request,
			{
				onChunk: (_text, accumulated) => {
					resultText = accumulated;
				},
				onError: (error) => {
					// Surface the failure as a transient toast keyed off the error
					// code (friendly Korean mapping). Any partial result already
					// rendered in `resultText` is intentionally kept so the user
					// does not lose what streamed before the error.
					toast.error(getErrorMessage(error), { duration: 10000 });
				},
				onDone: (fullText) => {
					if (fullText === '') return;
					const entry: TranslationHistoryEntry = {
						id: crypto.randomUUID(),
						request,
						response: fullText,
						providerName,
						modelName,
						createdAt: new Date().toISOString()
					};
					addHistoryEntry(entry);
				}
			},
			abortController.signal
		);

		isLoading = false;
		abortController = null;
	}

	function handleCancel(): void {
		abortController?.abort();
	}

	function handleFileUpload(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const isTxt =
			file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
		if (!isTxt) {
			toast.error(UI.ERRORS.INVALID_FILE_TYPE, { duration: 10000 });
			input.value = '';
			return;
		}

		const reader = new FileReader();
		reader.onload = () => {
			loadedFile = { name: file.name, content: reader.result as string };
			sourceText = '';
		};
		reader.readAsText(file);
	}

	function handleRemoveFile(): void {
		loadedFile = null;
	}

	function handleTextareaInput(): void {
		loadedFile = null;
	}
</script>

<svelte:head>
	<title>{UI.APP_TITLE}</title>
</svelte:head>

<div class="flex flex-col gap-4 py-4">
	<TranslateControls
		bind:sourceLang
		bind:targetLang
		bind:model
		{availableModels}
		{hasActiveProvider}
		{hasApiKey}
		{isLoading}
		{canTranslate}
		ontranslate={handleTranslate}
		oncancel={handleCancel}
	/>

	{#if !hasApiKey}
		<div
			data-testid="no-api-key-warning"
			class="flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-md px-4 py-2"
		>
			<span class="text-sm text-yellow-800 dark:text-yellow-200">
				{hasActiveProvider ? UI.ERRORS.NO_API_KEY : UI.ERRORS.NO_ACTIVE_PROVIDER}
			</span>
			<a
				href="/settings"
				class="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium whitespace-nowrap"
			>
				설정으로 이동 →
			</a>
		</div>
	{/if}

	{#if sourceLang === 'auto' && detectedLanguage}
		<div
			data-testid="detected-language"
			class="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md px-4 py-2"
		>
			<span class="text-sm text-blue-800 dark:text-blue-200">
				{UI.TRANSLATE_PAGE.DETECTED_LANGUAGE(languageName(detectedLanguage))}
			</span>
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2" style="min-height: 320px;">
		<div class="flex flex-col gap-1">
			{#if loadedFile}
				<div
					data-testid="loaded-file-chip"
					class="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700"
				>
					<svg
						class="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<span class="text-sm text-blue-700 dark:text-blue-300 font-medium truncate">
						{loadedFile.name}
					</span>
					<button
						type="button"
						data-testid="remove-file-button"
						onclick={handleRemoveFile}
						aria-label={UI.TRANSLATE_PAGE.BUTTON_UPLOAD}
						class="ml-auto text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300 transition flex-shrink-0"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			{/if}
		<Textarea
			data-testid="source-textarea"
			placeholder={UI.TRANSLATE_PAGE.PLACEHOLDER_SOURCE}
			bind:value={sourceText}
			oninput={handleTextareaInput}
			class="min-h-[300px] h-full resize-none"
		/>
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<label
						data-testid="file-upload-label"
						for="file-upload"
						class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition cursor-pointer"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						{UI.TRANSLATE_PAGE.BUTTON_UPLOAD}
					</label>
					<input
						id="file-upload"
						data-testid="file-upload-input"
						type="file"
						accept=".txt,text/plain"
						class="hidden"
						onchange={handleFileUpload}
					/>
				</div>
				<span class="text-xs text-gray-400 dark:text-gray-500">
					{UI.TRANSLATE_PAGE.CHAR_COUNT(charCount)}
				</span>
			</div>
		</div>

		<div
			data-testid="result-area"
			class="px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto"
			style="min-height: 300px;"
		>
			{#if resultText}
				<p data-testid="result-text" class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
					{resultText}
				</p>
			{/if}
			{#if !resultText}
				<p data-testid="result-placeholder" class="text-sm text-gray-400 dark:text-gray-500">
					{UI.TRANSLATE_PAGE.PLACEHOLDER_RESULT}
				</p>
			{/if}
		</div>
	</div>

	<AdvancedOptions
		bind:expanded={advancedExpanded}
		bind:customPrompt
		glossaryEnabled={glossary.enabled}
		glossaryCount={glossary.entries.length}
		onToggleGlossary={handleToggleGlossary}
	/>
</div>