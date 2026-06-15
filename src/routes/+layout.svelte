<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { ModeWatcher } from 'mode-watcher';
	import { toast } from 'svelte-sonner';

	let { children } = $props();

	// Surface network connectivity changes as transient toasts. Registered once
	// per layout mount; listeners are cleaned up automatically by the browser on
	// navigation since they attach to the same `window` instance SvelteKit
	// reuses. The SSR guard keeps this inert during server rendering.
	$effect(() => {
		if (typeof window === 'undefined') return;

		function handleOffline(): void {
			toast.warning('네트워크 연결이 끊어졌습니다.');
		}
		function handleOnline(): void {
			toast.info('네트워크가 복구되었습니다.');
		}

		window.addEventListener('offline', handleOffline);
		window.addEventListener('online', handleOnline);
		return () => {
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('online', handleOnline);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
<Toaster />

<div class="min-h-screen bg-background text-foreground">
	<Nav />
	<main class="max-w-4xl mx-auto p-4">
		{@render children()}
	</main>
</div>
