<script lang="ts">
  // Auth routes (/login, /auth/callback) get a clean chrome: no sidebar,
  // no app shell. Each auth page renders its own full-screen layout.
  let { children } = $props();
</script>

<div class="min-h-screen bg-background text-foreground">
  {@render children()}
</div>
