<script lang="ts">
  import { _ } from "svelte-i18n";
  import SettingsPanel from "$lib/components/SettingsPanel.svelte";
</script>

<svelte:head>
  <title>{$_("settings_page.title")} – {$_("app.title")}</title>
</svelte:head>

<div class="py-4">
  <SettingsPanel />
</div>
