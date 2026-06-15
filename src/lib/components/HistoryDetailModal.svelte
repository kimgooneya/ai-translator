<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import { UI } from '$lib/constants/ui-strings';
	import type { TranslationHistoryEntry } from '$lib/schemas';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	let {
		entry,
		onclose
	}: { entry: TranslationHistoryEntry | null; onclose: () => void } = $props();

	let open = $derived(entry !== null);

	function handleOpenChange(next: boolean): void {
		if (!next) {
			onclose();
		}
	}

	let createdAtLabel = $derived(
		entry ? UI.HISTORY_PAGE.CREATED_AT_FORMATTER(new Date(entry.createdAt)) : ''
	);
</script>

<DialogPrimitive.Root {open} onOpenChange={handleOpenChange}>
	<DialogPrimitive.Portal>
		<Dialog.Overlay
			data-testid="history-detail-backdrop"
		/>
		<DialogPrimitive.Content
			data-testid="history-detail-modal"
			class="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 max-h-[85vh] overflow-y-auto"
		>
			<Dialog.Header>
				<Dialog.Title>{UI.HISTORY_PAGE.TITLE}</Dialog.Title>
				<Dialog.Description class="sr-only">
					{UI.HISTORY_PAGE.TITLE}
				</Dialog.Description>
			</Dialog.Header>

			{#if entry}
				<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
					<span
						data-testid="history-detail-created-at"
						class="text-muted-foreground tabular-nums"
					>
						{createdAtLabel}
					</span>
					<span
						data-testid="history-detail-provider"
						class="font-medium text-foreground"
					>
						{entry.providerName}
					</span>
					<span
						data-testid="history-detail-model"
						class="text-muted-foreground break-all"
					>
						{entry.modelName}
					</span>
					{#if entry.tokensUsed !== undefined}
						<Badge
							variant="secondary"
							data-testid="history-detail-tokens"
						>
							tokens: {entry.tokensUsed}
						</Badge>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2 text-sm">
					<Badge
						variant="secondary"
						data-testid="history-detail-source-lang"
					>
						{entry.request.sourceLang}
					</Badge>
					<span class="text-muted-foreground" aria-hidden="true">→</span>
					<Badge
						variant="secondary"
						data-testid="history-detail-target-lang"
					>
						{entry.request.targetLang}
					</Badge>
				</div>

				<Separator />

				{#if entry.request.customPrompt}
					<div class="flex flex-col gap-1">
						<span class="text-xs font-medium text-muted-foreground">
							{UI.TRANSLATE_PAGE.LABEL_CUSTOM_PROMPT}
						</span>
						<p
							data-testid="history-detail-custom-prompt"
							class="text-sm text-foreground bg-muted rounded-md p-3 break-words whitespace-pre-wrap"
						>
							{entry.request.customPrompt}
						</p>
					</div>
				{/if}

				{#if entry.request.glossary}
					<div
						data-testid="history-detail-glossary"
						class="text-xs text-muted-foreground"
					>
						{UI.TRANSLATE_PAGE.LABEL_GLOSSARY_TOGGLE}:
						{entry.request.glossary.enabled ? '사용' : '미사용'}
						{#if entry.request.glossary.entries.length > 0}
							({entry.request.glossary.entries.length}개)
						{/if}
					</div>
				{/if}

				<div class="flex flex-col gap-1">
					<span class="text-xs font-medium text-muted-foreground">
						{UI.TRANSLATE_PAGE.PLACEHOLDER_SOURCE}
					</span>
					<p
						data-testid="history-detail-source"
						class="text-sm text-foreground bg-muted rounded-md p-3 break-words whitespace-pre-wrap"
					>
						{entry.request.sourceText}
					</p>
				</div>

				<div class="flex flex-col gap-1">
					<span class="text-xs font-medium text-muted-foreground">
						{UI.TRANSLATE_PAGE.PLACEHOLDER_RESULT}
					</span>
					<p
						data-testid="history-detail-response"
						class="text-sm text-foreground bg-primary/10 rounded-md p-3 break-words whitespace-pre-wrap"
					>
						{entry.response}
					</p>
				</div>
			{/if}

			<Button
				variant="ghost"
				size="icon"
				data-testid="history-detail-close"
				class="absolute end-4 top-4"
				aria-label="닫기"
				onclick={() => onclose()}
			>
				<X class="size-4" />
			</Button>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
