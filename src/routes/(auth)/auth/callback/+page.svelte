<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { supabaseBrowser } from "$lib/supabase/client";

  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const { error: exchangeError } =
        await supabaseBrowser.auth.exchangeCodeForSession(window.location.href);
      if (exchangeError) {
        console.error("[auth] code exchange failed:", exchangeError);
        error = exchangeError.message;
        return;
      }
      goto("/", { replaceState: true });
    } catch (err) {
      console.error("[auth] callback error:", err);
      error = err instanceof Error ? err.message : String(err);
    }
  });
</script>

<svelte:head>
  <title>{$_("app.title")} · {$_("auth.signing_in")}</title>
</svelte:head>

<div
  class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center"
  data-testid="auth-callback"
>
  {#if error}
    <p class="text-sm text-destructive">{$_("auth.callback_error")}</p>
    <p class="max-w-sm text-xs text-muted-foreground">{error}</p>
    <a
      href="/login"
      class="text-sm font-medium text-foreground underline-offset-4 hover:underline"
    >
      {$_("auth.back_to_login")}
    </a>
  {:else}
    <span
      class="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-muted-foreground"
      aria-hidden="true"
    ></span>
    <p class="text-sm text-muted-foreground">{$_("auth.signing_in")}</p>
  {/if}
</div>
