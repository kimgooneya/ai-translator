<script lang="ts">
	import { slide } from 'svelte/transition';
	import { toasts, type ToastType } from '$lib/stores/toasts';

	/**
	 * Per-type visual styles. Each value is a complete literal class string so
	 * Tailwind's content scanner keeps every variant (incl. `dark:`) in the
	 * build. Palette matches the app's existing alert conventions (see the
	 * `no-api-key-warning` in +page.svelte).
	 */
	const stylesByType: Record<ToastType, { container: string; icon: string; glyph: string }> = {
		info: {
			container:
				'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200',
			icon: 'bg-blue-500 text-white',
			glyph: 'i'
		},
		success: {
			container:
				'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200',
			icon: 'bg-green-500 text-white',
			glyph: '✓'
		},
		warning: {
			container:
				'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200',
			icon: 'bg-yellow-500 text-white',
			glyph: '!'
		},
		error: {
			container:
				'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200',
			icon: 'bg-red-500 text-white',
			glyph: '!'
		}
	};

	const items = $derived($toasts);
</script>

{#if items.length > 0}
	<div
		data-testid="toast-container"
		class="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
		role="region"
		aria-label="알림"
		aria-live="polite"
	>
		{#each items as toast (toast.id)}
			{@const style = stylesByType[toast.type]}
			<div
				data-testid="toast"
				data-toast-type={toast.type}
				transition:slide={{ duration: 220 }}
				class="flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md {style.container}"
				role="alert"
			>
				<span
					class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold {style.icon}"
					aria-hidden="true"
				>
					{style.glyph}
				</span>
				<p data-testid="toast-message" class="flex-1 text-sm leading-snug break-words">
					{toast.message}
				</p>
				<button
					type="button"
					data-testid="toast-close"
					onclick={() => toasts.removeToast(toast.id)}
					class="flex-shrink-0 -mt-0.5 text-current opacity-60 hover:opacity-100 transition-opacity text-lg leading-none px-1"
					aria-label="알림 닫기"
				>
					&times;
				</button>
			</div>
		{/each}
	</div>
{/if}
