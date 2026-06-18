<script lang="ts">
  import X from "@lucide/svelte/icons/x";
  import { _, locale } from "svelte-i18n";
  import { formatDate } from "$lib/i18n";
  import type { TranslationHistoryEntry } from "$lib/schemas";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";

  let {
    entry,
    onclose,
  }: { entry: TranslationHistoryEntry; onclose: () => void } = $props();

  let createdAtLabel = $derived(formatDate(new Date(entry.createdAt), $locale));
</script>

<section
  data-testid="history-detail-modal"
  class="bg-background border rounded-lg p-6 shadow-sm flex flex-col gap-4 relative"
>
  <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
    <span
      data-testid="history-detail-created-at"
      class="text-muted-foreground tabular-nums"
    >
      {createdAtLabel}
    </span>
    <span
      data-testid="history-detail-provider"
      class="font-medium text-foreground"
    >
      {entry.providerName}
    </span>
    <span
      data-testid="history-detail-model"
      class="text-muted-foreground break-all"
    >
      {entry.modelName}
    </span>
    {#if entry.tokensUsed !== undefined}
      <Badge variant="secondary" data-testid="history-detail-tokens">
        tokens: {entry.tokensUsed}
      </Badge>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-2 text-sm">
    <Badge variant="secondary" data-testid="history-detail-source-lang">
      {entry.request.sourceLang}
    </Badge>
    <span class="text-muted-foreground" aria-hidden="true">→</span>
    <Badge variant="secondary" data-testid="history-detail-target-lang">
      {entry.request.targetLang}
    </Badge>
  </div>

  <Separator />

  {#if entry.request.customPrompt}
    <div class="flex flex-col gap-1">
      <span class="text-xs font-medium text-muted-foreground">
        {$_("translate_page.label_custom_prompt")}
      </span>
      <p
        data-testid="history-detail-custom-prompt"
        class="text-sm text-foreground bg-muted rounded-md p-3 break-words whitespace-pre-wrap"
      >
        {entry.request.customPrompt}
      </p>
    </div>
  {/if}

  {#if entry.request.glossary}
    <div
      data-testid="history-detail-glossary"
      class="text-xs text-muted-foreground"
    >
      {$_("translate_page.label_glossary_toggle")}:
      {entry.request.glossary.enabled
        ? $_("history_page.glossary_state_enabled")
        : $_("history_page.glossary_state_disabled")}
      {#if entry.request.glossary.entries.length > 0}
        {$_("history_page.glossary_entries_count", {
          values: { n: entry.request.glossary.entries.length },
        })}
      {/if}
    </div>
  {/if}

  <div class="flex flex-col gap-1">
    <span class="text-xs font-medium text-muted-foreground">
      {$_("translate_page.placeholder_source")}
    </span>
    <p
      data-testid="history-detail-source"
      class="text-sm text-foreground bg-muted rounded-md p-3 break-words whitespace-pre-wrap"
    >
      {entry.request.sourceText}
    </p>
  </div>

  <div class="flex flex-col gap-1">
    <span class="text-xs font-medium text-muted-foreground">
      {$_("translate_page.placeholder_result")}
    </span>
    <p
      data-testid="history-detail-response"
      class="text-sm text-foreground bg-primary/10 rounded-md p-3 break-words whitespace-pre-wrap"
    >
      {entry.response}
    </p>
  </div>

  <Button
    variant="ghost"
    size="icon"
    data-testid="history-detail-close"
    class="absolute end-4 top-4"
    aria-label={$_("common.close")}
    onclick={onclose}
  >
    <X class="size-4" />
  </Button>
</section>
