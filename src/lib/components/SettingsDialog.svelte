<script lang="ts">
  import { _ } from "svelte-i18n";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import SettingsPanel from "./SettingsPanel.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    data-testid="settings-dialog-content"
    class="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-4xl"
  >
    <!-- bits-ui Dialog requires a Title for a11y; keep it screen-reader-only
         since SettingsPanel already renders a visible <h1> heading. -->
    <Dialog.Header class="sr-only">
      <Dialog.Title>{$_("settings_page.title")}</Dialog.Title>
    </Dialog.Header>
    <SettingsPanel />
  </Dialog.Content>
</Dialog.Root>
