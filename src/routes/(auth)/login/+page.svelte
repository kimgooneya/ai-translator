<script lang="ts">
  import { _ } from "svelte-i18n";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import { supabaseBrowser } from "$lib/supabase/client";
  import { userStore } from "$lib/stores/auth";

  let loadingProvider = $state<"google" | "github" | null>(null);

  async function signInWith(provider: "google" | "github"): Promise<void> {
    loadingProvider = provider;
    try {
      await supabaseBrowser.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err) {
      console.error(`[auth] ${provider} sign-in failed:`, err);
      loadingProvider = null;
    }
  }

  // If a session already exists (e.g. user navigated to /login while signed
  // in), bounce them to the app root instead of showing the sign-in buttons.
  $effect(() => {
    if ($userStore) {
      goto("/", { replaceState: true });
    }
  });
</script>

<svelte:head>
  <title>{$_("app.title")} · {$_("auth.sign_in_to_continue")}</title>
</svelte:head>

<div
  class="flex min-h-screen items-center justify-center bg-background p-4"
  data-testid="login-page"
>
  <div
    class="bg-card text-card-foreground w-full max-w-sm rounded-lg border border-border p-8 shadow-sm"
  >
    <header class="mb-8 text-center">
      <div class="mb-3 text-3xl" aria-hidden="true">🌐</div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">
        {$_("app.title")}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {$_("auth.sign_in_to_continue")}
      </p>
    </header>

    <div class="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        class="w-full justify-center gap-2 font-medium"
        disabled={loadingProvider !== null}
        onclick={() => signInWith("google")}
        data-testid="login-google"
      >
        {#if loadingProvider === "google"}
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          ></span>
        {:else}
          <!-- Google "G" mark -->
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        {/if}
        {$_("auth.sign_in_with_google")}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="lg"
        class="w-full justify-center gap-2 font-medium"
        disabled={loadingProvider !== null}
        onclick={() => signInWith("github")}
        data-testid="login-github"
      >
        {#if loadingProvider === "github"}
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          ></span>
        {:else}
          <!-- GitHub mark -->
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12 1C5.92 1 1 5.92 1 12c0 4.86 3.15 8.98 7.52 10.44.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.06.66-3.71-1.3-3.71-1.3-.5-1.28-1.22-1.62-1.22-1.62-1-.68.07-.67.07-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.69-1.48-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.5 10.5 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.75 1.01.75 2.04 0 1.47-.01 2.66-.01 3.02 0 .29.2.64.76.53A11.01 11.01 0 0 0 23 12c0-6.08-4.92-11-11-11z"
            />
          </svg>
        {/if}
        {$_("auth.sign_in_with_github")}
      </Button>
    </div>
  </div>
</div>
