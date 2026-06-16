<script lang="ts">
	import type { Snippet } from "svelte";
	import XIcon from "@lucide/svelte/icons/x";
	import { Dialog as DialogPrimitive, type WithoutChild } from "bits-ui";
	import type { ComponentProps } from "svelte";
	import * as Sheet from "./index.js";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import SheetPortal from "./sheet-portal.svelte";
	import SheetOverlay from "./sheet-overlay.svelte";

	type Side = "top" | "right" | "bottom" | "left";

	let {
		ref = $bindable(null),
		class: className,
		side = "right",
		portalProps,
		children,
		showCloseButton = true,
		...restProps
	}: WithoutChildrenOrChild<DialogPrimitive.ContentProps> & {
		portalProps?: WithoutChild<ComponentProps<typeof SheetPortal>>;
		children: Snippet;
		showCloseButton?: boolean;
		side?: Side;
	} = $props();

	const sideClassMap: Record<Side, string> = {
		top: "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
		right:
			"inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
		bottom:
			"inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
		left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
	};
</script>

<SheetPortal {...portalProps}>
	<Sheet.Overlay />
	<DialogPrimitive.Content
		bind:ref
		data-slot="sheet-content"
		class={cn(
			"bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
			sideClassMap[side],
			className
		)}
		{...restProps}
	>
		{@render children?.()}
		{#if showCloseButton}
			<DialogPrimitive.Close
				class="ring-offset-background focus:ring-ring absolute end-4 top-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
			>
				<XIcon />
				<span class="sr-only">Close</span>
			</DialogPrimitive.Close>
		{/if}
	</DialogPrimitive.Content>
</SheetPortal>
