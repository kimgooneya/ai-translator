<script lang="ts">
  import { _ } from "svelte-i18n";
  import GlossaryPanel from "$lib/components/GlossaryPanel.svelte";
</script>

<svelte:head>
  <title>{$_("glossary_page.title")} – {$_("app.title")}</title>
</svelte:head>

<div class="py-4">
  <GlossaryPanel />
</div>
