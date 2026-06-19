<script lang="ts">
  import { _ } from "svelte-i18n";
  import { goto } from "$app/navigation";
  import LogOut from "@lucide/svelte/icons/log-out";
  import { Button } from "$lib/components/ui/button/index.js";
  import { userStore, profileStore, signOut } from "$lib/stores/auth";

  let user = $derived($userStore);
  let profile = $derived($profileStore);

  // Prefer the OAuth-provided avatar, then the profile row, then nothing.
  let avatarUrl = $derived(
    (user?.user_metadata?.avatar_url as string | undefined) ??
      profile?.avatar_url ??
      null,
  );

  // Prefer profile.name, then OAuth full_name/user_name, then email handle.
  let displayName = $derived(
    profile?.name ??
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.user_metadata?.user_name as string | undefined) ??
      user?.email?.split("@")[0] ??
      null,
  );

  let displayEmail = $derived(user?.email ?? null);

  // First letter of name/email for the initials fallback.
  let initial = $derived(
    (displayName ?? displayEmail ?? "?").trim().charAt(0).toUpperCase() || "?",
  );

  async function handleSignOut(): Promise<void> {
    await signOut();
    goto("/login", { replaceState: true });
  }
</script>

{#if user}
  <div class="flex items-center gap-2 px-2 py-1.5" data-testid="user-widget">
    <!-- Avatar / initials -->
    {#if avatarUrl}
      <img
        src={avatarUrl}
        alt=""
        class="h-7 w-7 shrink-0 rounded-full object-cover"
        referrerpolicy="no-referrer"
      />
    {:else}
      <span
        class="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        aria-hidden="true"
      >
        {initial}
      </span>
    {/if}

    <!-- Name + email (truncates inside the 256px sidebar) -->
    <div class="min-w-0 flex-1 leading-tight">
      {#if displayName}
        <p class="truncate text-xs font-medium text-foreground">
          {displayName}
        </p>
      {/if}
      {#if displayEmail && displayEmail !== displayName}
        <p class="truncate text-[11px] text-muted-foreground">
          {displayEmail}
        </p>
      {/if}
    </div>

    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="text-muted-foreground hover:text-foreground"
      aria-label={$_("auth.sign_out")}
      title={$_("auth.sign_out")}
      onclick={handleSignOut}
      data-testid="user-widget-signout"
    >
      <LogOut class="h-4 w-4" />
    </Button>
  </div>
{/if}
