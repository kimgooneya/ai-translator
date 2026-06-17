<script lang="ts">
  import { _ } from "svelte-i18n";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import GlossaryPanel from "./GlossaryPanel.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content
    data-testid="glossary-dialog-content"
    class="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-2xl"
  >
    <!-- bits-ui Dialog requires a Title for a11y; keep it screen-reader-only
         since GlossaryPanel already renders a visible <h1> heading. -->
    <Dialog.Header class="sr-only">
      <Dialog.Title>{$_("glossary_page.title")}</Dialog.Title>
    </Dialog.Header>
    <GlossaryPanel />
  </Dialog.Content>
</Dialog.Root>
