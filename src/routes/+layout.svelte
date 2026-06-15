<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Nav from '$lib/components/Nav.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { toasts } from '$lib/stores/toasts';

	let { children } = $props();

	// Surface network connectivity changes as transient toasts. Registered once
	// per layout mount; listeners are cleaned up automatically by the browser on
	// navigation since they attach to the same `window` instance SvelteKit
	// reuses. The SSR guard keeps this inert during server rendering.
	$effect(() => {
		if (typeof window === 'undefined') return;

		function handleOffline(): void {
			toasts.addToast({ type: 'warning', message: '네트워크 연결이 끊어졌습니다.' });
		}
		function handleOnline(): void {
			toasts.addToast({ type: 'info', message: '네트워크가 복구되었습니다.' });
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

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<Nav />
	<main class="max-w-4xl mx-auto p-4">
		{@render children()}
	</main>
</div>

<ToastContainer />
