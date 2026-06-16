<script lang="ts">
  import { _, locale } from "svelte-i18n";
  import { formatDate } from "$lib/i18n";
  import type { TranslationHistoryEntry } from "$lib/schemas";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";

  let {
    entry,
    onshowdetail,
    ondelete,
  }: {
    entry: TranslationHistoryEntry;
    onshowdetail: (entry: TranslationHistoryEntry) => void;
    ondelete: (id: string) => void;
  } = $props();

  function preview(text: string, n = 50): string {
    return text.length > n ? text.slice(0, n) + "..." : text;
  }

  let createdAtLabel = $derived(formatDate(new Date(entry.createdAt), $locale));
  let sourcePreview = $derived(preview(entry.request.sourceText));
  let responsePreview = $derived(preview(entry.response));
</script>

<Card.Root
  data-testid="history-entry-card"
  data-entry-id={entry.id}
  class="gap-3 py-4"
>
  <Card.Header>
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span
        data-testid="history-created-at"
        class="text-xs text-muted-foreground tabular-nums"
      >
        {createdAtLabel}
      </span>
      <span
        data-testid="history-provider"
        class="text-xs font-medium text-foreground"
      >
        {entry.providerName}
      </span>
      <span
        data-testid="history-model"
        class="text-xs text-muted-foreground break-all"
      >
        {entry.modelName}
      </span>
    </div>
  </Card.Header>

  <Card.Content class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="secondary" data-testid="history-source-lang">
        {entry.request.sourceLang}
      </Badge>
      <span class="text-muted-foreground" aria-hidden="true">→</span>
      <Badge variant="secondary" data-testid="history-target-lang">
        {entry.request.targetLang}
      </Badge>
    </div>

    <p
      data-testid="history-source-preview"
      class="text-sm text-muted-foreground break-words"
    >
      {sourcePreview}
    </p>
    <p
      data-testid="history-response-preview"
      class="text-sm text-foreground break-words"
    >
      {responsePreview}
    </p>
  </Card.Content>

  <Card.Footer class="gap-2">
    <Button
      variant="ghost"
      size="sm"
      data-testid="history-detail-button"
      onclick={() => onshowdetail(entry)}
    >
      {$_("history_page.button_detail")}
    </Button>
    <Button
      variant="ghost"
      size="sm"
      data-testid="history-delete-button"
      class="text-destructive hover:text-destructive"
      onclick={() => ondelete(entry.id)}
    >
      {$_("history_page.button_delete")}
    </Button>
  </Card.Footer>
</Card.Root>
