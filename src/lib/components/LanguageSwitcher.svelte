<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import Languages from "@lucide/svelte/icons/languages";
  import { localeStore } from "$lib/stores/locale";
  import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "$lib/i18n";
  import { _ } from "svelte-i18n";

  function onValueSelected(value: string): void {
    if ((SUPPORTED_LOCALES as readonly string[]).includes(value)) {
      localeStore.set(value as Locale);
    }
  }
</script>

<Select.Root type="single" value={$localeStore} onValueChange={onValueSelected}>
  <Select.Trigger
    data-testid="language-switcher"
    class="h-9 px-2 text-sm"
    aria-label={$_("language_switcher.label")}
  >
    <div class="flex items-center gap-1.5">
      <Languages class="h-4 w-4" />
      <span>{LOCALE_LABELS[$localeStore]}</span>
    </div>
  </Select.Trigger>
  <Select.Content>
    {#each SUPPORTED_LOCALES as loc (loc)}
      <Select.Item value={loc} label={LOCALE_LABELS[loc]}>
        {LOCALE_LABELS[loc]}
      </Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
