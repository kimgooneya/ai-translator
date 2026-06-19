<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash from "@lucide/svelte/icons/trash";
  import Pencil from "@lucide/svelte/icons/pencil";
  import KeyRound from "@lucide/svelte/icons/key-round";

  type Preset = {
    id: string;
    display_name: string;
    base_url: string;
    models: string[];
    default_model: string;
    enabled: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    updated_by: string | null;
    active_key_count: number;
  };

  type KeyView = {
    id: string;
    provider_id: string;
    key_hint: string;
    label: string | null;
    enabled: boolean;
    created_at: string;
  };

  let presets = $state<Preset[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let expandedProviderId = $state<string | null>(null);
  let keysByProvider = $state<Record<string, KeyView[]>>({});
  let keysLoading = $state<Record<string, boolean>>({});

  // Add-preset dialog state
  let addDialogOpen = $state(false);
  let newPreset = $state({
    id: "",
    display_name: "",
    base_url: "",
    models: "",
    default_model: "",
    enabled: true,
    sort_order: 0,
  });

  // Edit-preset dialog state
  let editDialogOpen = $state(false);
  let editingPreset = $state<Preset | null>(null);
  let editForm = $state({
    display_name: "",
    base_url: "",
    models: "",
    default_model: "",
    enabled: true,
    sort_order: 0,
  });

  // Add-key form state (only one provider is expanded at a time, so a single
  // pair of inputs is enough — no need for a per-provider map).
  let newKeyPlaintext = $state("");
  let newKeyLabel = $state("");

  async function loadPresets(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const res = await fetch("/api/admin/providers");
      if (!res.ok) {
        loadError = $_("admin.providers.load_error");
        return;
      }
      const body = (await res.json()) as { presets: Preset[] };
      presets = body.presets ?? [];
    } catch {
      loadError = $_("admin.providers.load_error");
    } finally {
      loading = false;
    }
  }

  async function loadKeys(providerId: string): Promise<void> {
    keysLoading[providerId] = true;
    try {
      const res = await fetch(
        `/api/admin/provider-keys?provider_id=${encodeURIComponent(providerId)}`,
      );
      if (!res.ok) {
        toast.error($_("admin.providers.keys_load_error"));
        return;
      }
      const body = (await res.json()) as { keys: KeyView[] };
      keysByProvider[providerId] = body.keys ?? [];
    } catch {
      toast.error($_("admin.providers.keys_load_error"));
    } finally {
      keysLoading[providerId] = false;
    }
  }

  function toggleProvider(providerId: string): void {
    if (expandedProviderId === providerId) {
      expandedProviderId = null;
      return;
    }
    expandedProviderId = providerId;
    newKeyPlaintext = "";
    newKeyLabel = "";
    if (!keysByProvider[providerId]) {
      void loadKeys(providerId);
    }
  }

  async function handleAddPreset(): Promise<void> {
    const models = newPreset.models
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (
      !newPreset.id ||
      !newPreset.display_name ||
      !newPreset.base_url ||
      models.length === 0 ||
      !newPreset.default_model
    ) {
      toast.error($_("admin.providers.form_incomplete"));
      return;
    }
    if (!models.includes(newPreset.default_model)) {
      toast.error($_("admin.providers.default_model_not_in_models"));
      return;
    }
    const res = await fetch("/api/admin/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: newPreset.id,
        display_name: newPreset.display_name,
        base_url: newPreset.base_url,
        models,
        default_model: newPreset.default_model,
        enabled: newPreset.enabled,
        sort_order: newPreset.sort_order,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.providers.add_error"));
      return;
    }
    toast.success($_("admin.providers.added"));
    addDialogOpen = false;
    newPreset = {
      id: "",
      display_name: "",
      base_url: "",
      models: "",
      default_model: "",
      enabled: true,
      sort_order: 0,
    };
    await loadPresets();
  }

  function openEdit(preset: Preset): void {
    editingPreset = preset;
    editForm = {
      display_name: preset.display_name,
      base_url: preset.base_url,
      models: preset.models.join(", "),
      default_model: preset.default_model,
      enabled: preset.enabled,
      sort_order: preset.sort_order,
    };
    editDialogOpen = true;
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingPreset) return;
    const models = editForm.models
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (
      !editForm.display_name ||
      !editForm.base_url ||
      models.length === 0 ||
      !editForm.default_model
    ) {
      toast.error($_("admin.providers.form_incomplete"));
      return;
    }
    if (!models.includes(editForm.default_model)) {
      toast.error($_("admin.providers.default_model_not_in_models"));
      return;
    }
    const res = await fetch("/api/admin/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingPreset.id,
        display_name: editForm.display_name,
        base_url: editForm.base_url,
        models,
        default_model: editForm.default_model,
        enabled: editForm.enabled,
        sort_order: editForm.sort_order,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.providers.save_error"));
      return;
    }
    toast.success($_("admin.providers.saved"));
    editDialogOpen = false;
    editingPreset = null;
    await loadPresets();
  }

  async function handleDeletePreset(preset: Preset): Promise<void> {
    if (!confirm($_("admin.providers.confirm_delete", { values: { name: preset.display_name } }))) {
      return;
    }
    const res = await fetch("/api/admin/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: preset.id }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.providers.delete_error"));
      return;
    }
    const body = (await res.json()) as { cascaded_keys_deleted: number };
    toast.success(
      $_("admin.providers.deleted", {
        values: { n: body.cascaded_keys_deleted ?? 0 },
      }),
    );
    if (expandedProviderId === preset.id) expandedProviderId = null;
    await loadPresets();
  }

  async function handleAddKey(providerId: string): Promise<void> {
    if (!newKeyPlaintext) {
      toast.error($_("admin.providers.key_required"));
      return;
    }
    const res = await fetch("/api/admin/provider-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider_id: providerId,
        plaintext_key: newKeyPlaintext,
        label: newKeyLabel || null,
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.providers.key_add_error"));
      return;
    }
    // Plaintext is consumed server-side; clear client state immediately.
    newKeyPlaintext = "";
    newKeyLabel = "";
    toast.success($_("admin.providers.key_added"));
    await loadKeys(providerId);
    await loadPresets();
  }

  async function handleToggleKey(key: KeyView, value: boolean): Promise<void> {
    const res = await fetch("/api/admin/provider-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key.id, enabled: value }),
    });
    if (!res.ok) {
      toast.error($_("admin.providers.key_update_error"));
      return;
    }
    await loadKeys(key.provider_id);
    await loadPresets();
  }

  async function handleDeleteKey(key: KeyView): Promise<void> {
    if (!confirm($_("admin.providers.confirm_delete_key"))) return;
    const res = await fetch("/api/admin/provider-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: key.id }),
    });
    if (!res.ok) {
      toast.error($_("admin.providers.key_delete_error"));
      return;
    }
    toast.success($_("admin.providers.key_deleted"));
    await loadKeys(key.provider_id);
    await loadPresets();
  }

  onMount(() => {
    void loadPresets();
  });
</script>

<svelte:head>
  <title>{$_("admin.providers.title")} – {$_("admin.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
  <header class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">
        {$_("admin.providers.title")}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {$_("admin.providers.subtitle")}
      </p>
    </div>
    <Button onclick={() => (addDialogOpen = true)} data-testid="add-preset-button">
      <Plus class="h-4 w-4" />
      {$_("admin.providers.add")}
    </Button>
  </header>

  {#if loading}
    <p data-testid="admin-providers-loading" class="text-sm text-muted-foreground">
      {$_("admin.providers.loading")}
    </p>
  {:else if loadError}
    <p data-testid="admin-providers-error" class="text-sm text-destructive">
      {loadError}
    </p>
  {:else if presets.length === 0}
    <p data-testid="admin-providers-empty" class="text-sm text-muted-foreground">
      {$_("admin.providers.empty")}
    </p>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>{$_("admin.providers.presets_title")}</Card.Title>
      </Card.Header>
      <Card.Content>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{$_("admin.providers.col_id")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_name")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_base_url")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_models")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_enabled")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_keys")}</Table.Head>
              <Table.Head>{$_("admin.providers.col_actions")}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each presets as preset (preset.id)}
              <Table.Row data-testid={`preset-row-${preset.id}`}>
                <Table.Cell class="font-mono text-xs">{preset.id}</Table.Cell>
                <Table.Cell class="font-medium">{preset.display_name}</Table.Cell>
                <Table.Cell class="max-w-[20rem] truncate text-xs text-muted-foreground">
                  {preset.base_url}
                </Table.Cell>
                <Table.Cell class="text-xs text-muted-foreground">
                  {preset.models.length} · {preset.default_model}
                </Table.Cell>
                <Table.Cell>
                  <Badge variant={preset.enabled ? "secondary" : "outline"}>
                    {preset.enabled
                      ? $_("admin.providers.enabled")
                      : $_("admin.providers.disabled")}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-xs hover:underline"
                    onclick={() => toggleProvider(preset.id)}
                    data-testid={`toggle-keys-${preset.id}`}
                  >
                    <KeyRound class="h-3 w-3" />
                    {preset.active_key_count}
                  </button>
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={$_("admin.providers.edit")}
                      onclick={() => openEdit(preset)}
                      data-testid={`edit-preset-${preset.id}`}
                    >
                      <Pencil class="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={$_("admin.providers.delete")}
                      onclick={() => handleDeletePreset(preset)}
                      data-testid={`delete-preset-${preset.id}`}
                    >
                      <Trash class="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
              {#if expandedProviderId === preset.id}
                <Table.Row data-testid={`keys-row-${preset.id}`}>
                  <Table.Cell colspan={7} class="bg-muted/30">
                    <div class="flex flex-col gap-3 py-3">
                      <div class="flex items-center justify-between">
                        <h4 class="text-sm font-semibold">
                          {$_("admin.providers.keys_for", {
                            values: { name: preset.display_name },
                          })}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onclick={() => loadKeys(preset.id)}
                        >
                          {$_("admin.providers.refresh_keys")}
                        </Button>
                      </div>

                      {#if keysLoading[preset.id]}
                        <p class="text-xs text-muted-foreground">
                          {$_("admin.providers.loading_keys")}
                        </p>
                      {:else if (keysByProvider[preset.id] ?? []).length === 0}
                        <p class="text-xs text-muted-foreground">
                          {$_("admin.providers.no_keys")}
                        </p>
                      {:else}
                        <Table.Root>
                          <Table.Header>
                            <Table.Row>
                              <Table.Head>{$_("admin.providers.col_key_hint")}</Table.Head>
                              <Table.Head>{$_("admin.providers.col_label")}</Table.Head>
                              <Table.Head>{$_("admin.providers.col_enabled")}</Table.Head>
                              <Table.Head>{$_("admin.providers.col_created")}</Table.Head>
                              <Table.Head>{$_("admin.providers.col_actions")}</Table.Head>
                            </Table.Row>
                          </Table.Header>
                          <Table.Body>
                            {#each keysByProvider[preset.id] ?? [] as key (key.id)}
                              <Table.Row data-testid={`key-row-${key.id}`}>
                                <Table.Cell class="font-mono text-xs" data-testid={`key-hint-${key.id}`}>
                                  {key.key_hint}
                                </Table.Cell>
                                <Table.Cell class="text-xs">
                                  {key.label ?? "—"}
                                </Table.Cell>
                                <Table.Cell>
                                  <Switch
                                    checked={key.enabled}
                                    onCheckedChange={(v: boolean) => handleToggleKey(key, v)}
                                  />
                                </Table.Cell>
                                <Table.Cell class="text-xs text-muted-foreground">
                                  {new Date(key.created_at).toLocaleDateString()}
                                </Table.Cell>
                                <Table.Cell>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={$_("admin.providers.delete_key")}
                                    onclick={() => handleDeleteKey(key)}
                                  >
                                    <Trash class="h-3.5 w-3.5" />
                                  </Button>
                                </Table.Cell>
                              </Table.Row>
                            {/each}
                          </Table.Body>
                        </Table.Root>
                      {/if}

                      <form
                        class="flex flex-col gap-2 sm:flex-row sm:items-end"
                        onsubmit={(e) => {
                          e.preventDefault();
                          void handleAddKey(preset.id);
                        }}
                      >
                        <div class="flex-1">
                          <Label for={`new-key-${preset.id}`}>
                            {$_("admin.providers.new_key")}
                          </Label>
                          <Input
                            id={`new-key-${preset.id}`}
                            type="password"
                            autocomplete="off"
                            placeholder={$_("admin.providers.new_key_placeholder")}
                            bind:value={newKeyPlaintext}
                            data-testid={`new-key-input-${preset.id}`}
                          />
                        </div>
                        <div class="flex-1">
                          <Label for={`new-key-label-${preset.id}`}>
                            {$_("admin.providers.new_key_label")}
                          </Label>
                          <Input
                            id={`new-key-label-${preset.id}`}
                            type="text"
                            placeholder={$_("admin.providers.new_key_label_placeholder")}
                            bind:value={newKeyLabel}
                          />
                        </div>
                        <Button type="submit" data-testid={`add-key-button-${preset.id}`}>
                          {$_("admin.providers.add_key")}
                        </Button>
                      </form>
                    </div>
                  </Table.Cell>
                </Table.Row>
              {/if}
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {/if}
</div>

<!-- Add preset dialog -->
<Dialog.Root bind:open={addDialogOpen}>
  <Dialog.Content class="sm:max-w-md" data-testid="add-preset-dialog">
    <Dialog.Header>
      <Dialog.Title>{$_("admin.providers.add_title")}</Dialog.Title>
      <Dialog.Description>
        {$_("admin.providers.add_desc")}
      </Dialog.Description>
    </Dialog.Header>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        void handleAddPreset();
      }}
    >
      <div>
        <Label for="np-id">{$_("admin.providers.col_id")}</Label>
        <Input id="np-id" bind:value={newPreset.id} placeholder="openai" />
      </div>
      <div>
        <Label for="np-name">{$_("admin.providers.col_name")}</Label>
        <Input id="np-name" bind:value={newPreset.display_name} placeholder="OpenAI" />
      </div>
      <div>
        <Label for="np-url">{$_("admin.providers.col_base_url")}</Label>
        <Input
          id="np-url"
          bind:value={newPreset.base_url}
          placeholder="https://api.openai.com/v1"
        />
      </div>
      <div>
        <Label for="np-models">{$_("admin.providers.col_models")}</Label>
        <Input
          id="np-models"
          bind:value={newPreset.models}
          placeholder="gpt-5.5, gpt-5.4, gpt-5.4-mini"
        />
      </div>
      <div>
        <Label for="np-default">{$_("admin.providers.col_default_model")}</Label>
        <Input id="np-default" bind:value={newPreset.default_model} placeholder="gpt-5.4-mini" />
      </div>
      <div class="flex items-center gap-2">
        <Switch bind:checked={newPreset.enabled} id="np-enabled" />
        <Label for="np-enabled">{$_("admin.providers.enabled")}</Label>
      </div>
      <div>
        <Label for="np-sort">{$_("admin.providers.col_sort_order")}</Label>
        <Input id="np-sort" type="number" bind:value={newPreset.sort_order} />
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (addDialogOpen = false)}>
          {$_("admin.providers.cancel")}
        </Button>
        <Button type="submit" data-testid="submit-add-preset">
          {$_("admin.providers.add")}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<!-- Edit preset dialog -->
<Dialog.Root bind:open={editDialogOpen}>
  <Dialog.Content class="sm:max-w-md" data-testid="edit-preset-dialog">
    <Dialog.Header>
      <Dialog.Title>{$_("admin.providers.edit_title")}</Dialog.Title>
      {#if editingPreset}
        <Dialog.Description>
          {$_("admin.providers.edit_desc", { values: { id: editingPreset.id } })}
        </Dialog.Description>
      {/if}
    </Dialog.Header>
    <form
      class="flex flex-col gap-3"
      onsubmit={(e) => {
        e.preventDefault();
        void handleSaveEdit();
      }}
    >
      <div>
        <Label for="ep-name">{$_("admin.providers.col_name")}</Label>
        <Input id="ep-name" bind:value={editForm.display_name} />
      </div>
      <div>
        <Label for="ep-url">{$_("admin.providers.col_base_url")}</Label>
        <Input id="ep-url" bind:value={editForm.base_url} />
      </div>
      <div>
        <Label for="ep-models">{$_("admin.providers.col_models")}</Label>
        <Input id="ep-models" bind:value={editForm.models} />
      </div>
      <div>
        <Label for="ep-default">{$_("admin.providers.col_default_model")}</Label>
        <Input id="ep-default" bind:value={editForm.default_model} />
      </div>
      <div class="flex items-center gap-2">
        <Switch bind:checked={editForm.enabled} id="ep-enabled" />
        <Label for="ep-enabled">{$_("admin.providers.enabled")}</Label>
      </div>
      <div>
        <Label for="ep-sort">{$_("admin.providers.col_sort_order")}</Label>
        <Input id="ep-sort" type="number" bind:value={editForm.sort_order} />
      </div>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (editDialogOpen = false)}>
          {$_("admin.providers.cancel")}
        </Button>
        <Button type="submit" data-testid="submit-edit-preset">
          {$_("admin.providers.save")}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
