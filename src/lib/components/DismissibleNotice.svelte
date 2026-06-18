<script lang="ts">
  import { _ } from "svelte-i18n";
  import { dismissedNoticesStore, dismissNotice } from "$lib/stores/notices";

  type Props = {
    id: string;
    message: string;
    variant?: "yellow" | "red" | "blue";
    testId?: string;
  };

  let { id, message, variant = "yellow", testId }: Props = $props();

  let bannerClass = $derived(
    variant === "yellow"
      ? "border border-yellow-200 bg-yellow-50 rounded-md p-4 dark:border-yellow-700 dark:bg-yellow-900/30"
      : variant === "red"
        ? "border border-destructive/20 bg-destructive/10 rounded-md p-4"
        : "border border-primary/20 bg-primary/10 rounded-md p-4",
  );

  let textClass = $derived(
    variant === "yellow"
      ? "text-sm text-yellow-800 dark:text-yellow-200"
      : variant === "red"
        ? "text-sm text-destructive"
        : "text-sm text-primary",
  );

  let dismissed = $derived($dismissedNoticesStore.includes(id));
</script>

{#if !dismissed}
  <div data-testid={testId} class={bannerClass} role="status">
    <div class="flex items-start gap-3">
      <p class={`${textClass} flex-1`}>{message}</p>
      <button
        type="button"
        aria-label={$_("common.close")}
        onclick={() => dismissNotice(id)}
        class="flex-shrink-0 text-current opacity-60 hover:opacity-100 transition"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
{/if}
