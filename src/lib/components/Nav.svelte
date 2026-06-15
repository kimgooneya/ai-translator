<script lang="ts">
	import { page } from '$app/stores';
	import { UI } from '$lib/constants/ui-strings';

	const links = [
		{ href: '/', label: UI.NAV.TRANSLATE },
		{ href: '/settings', label: UI.NAV.SETTINGS },
		{ href: '/glossary', label: UI.NAV.GLOSSARY },
		{ href: '/history', label: UI.NAV.HISTORY }
	];

	function isActive(href: string, pathname: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname === href || pathname.startsWith(href + '/');
	}
</script>

<nav class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
	<div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
		<a href="/" class="text-lg font-bold text-gray-800 dark:text-gray-100">{UI.APP_TITLE}</a>
		<div class="flex gap-4">
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="text-sm px-2 py-1 rounded transition-colors {isActive(
						link.href,
						$page.url.pathname
					)
						? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/30'
						: 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100'}"
					aria-current={isActive(link.href, $page.url.pathname) ? 'page' : undefined}
				>
					{link.label}
				</a>
			{/each}
		</div>
	</div>
</nav>
