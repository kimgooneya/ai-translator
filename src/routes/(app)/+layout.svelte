<script lang="ts">
  import Sidebar from "$lib/components/Sidebar.svelte";

  let { children } = $props();
</script>

<div class="flex min-h-screen bg-background text-foreground">
  <Sidebar />
  <main class="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
    {@render children()}
  </main>
</div>
