<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { loadProviderCatalog } from "$lib/stores/providers";

  let { children } = $props();

  // Fetch the admin-managed provider catalog once on mount. The catalog is
  // sourced from `provider_presets` (RLS allows authenticated reads) and is
  // consumed by the translate page (model dropdown) and the settings page
  // (provider selection). Safe to retry — see loadProviderCatalog.
  $effect(() => {
    void loadProviderCatalog();
  });
</script>

<div class="flex min-h-screen bg-background text-foreground">
  <Sidebar />
  <main class="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
    {@render children()}
  </main>
</div>
