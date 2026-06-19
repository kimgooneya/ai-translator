<script lang="ts">
  import { _ } from "svelte-i18n";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { profileStore } from "$lib/stores/auth";

  type UserRow = {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    role: "user" | "admin";
    status: "active" | "suspended";
    created_at: string;
    usage_count: number;
    total_chars: number;
  };

  let users = $state<UserRow[]>([]);
  let total = $state(0);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let search = $state("");
  let me = $derived($profileStore);

  async function load(): Promise<void> {
    loading = true;
    loadError = null;
    try {
      const url = new URL("/api/admin/users", window.location.origin);
      if (search.trim()) url.searchParams.set("search", search.trim());
      const res = await fetch(url.toString());
      if (!res.ok) {
        loadError = $_("admin.users.load_error");
        return;
      }
      const body = (await res.json()) as {
        users: UserRow[];
        total: number;
      };
      users = body.users ?? [];
      total = body.total ?? 0;
    } catch {
      loadError = $_("admin.users.load_error");
    } finally {
      loading = false;
    }
  }

  async function handleChangeRole(user: UserRow, role: "user" | "admin"): Promise<void> {
    if (user.role === role) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.users.update_error"));
      return;
    }
    toast.success($_("admin.users.role_updated"));
    await load();
  }

  async function handleToggleStatus(user: UserRow, status: "active" | "suspended"): Promise<void> {
    if (user.status === status) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, status }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(body.message ?? $_("admin.users.update_error"));
      return;
    }
    toast.success($_("admin.users.status_updated"));
    await load();
  }

  onMount(() => {
    void load();
  });

  let searchInput = $state("");
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (searchInput !== search) {
        search = searchInput;
        void load();
      }
    }, 300);
  });
</script>

<svelte:head>
  <title>{$_("admin.users.title")} – {$_("admin.title")}</title>
</svelte:head>

<div class="flex flex-col gap-6 py-4">
  <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">
        {$_("admin.users.title")}
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {$_("admin.users.subtitle")}
      </p>
    </div>
    <div class="w-full sm:w-64">
      <Input
        type="search"
        placeholder={$_("admin.users.search_placeholder")}
        bind:value={searchInput}
        data-testid="users-search"
      />
    </div>
  </header>

  {#if loading}
    <p data-testid="admin-users-loading" class="text-sm text-muted-foreground">
      {$_("admin.users.loading")}
    </p>
  {:else if loadError}
    <p data-testid="admin-users-error" class="text-sm text-destructive">
      {loadError}
    </p>
  {:else}
    <Card.Root>
      <Card.Content class="pt-6">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>{$_("admin.users.col_email")}</Table.Head>
              <Table.Head>{$_("admin.users.col_name")}</Table.Head>
              <Table.Head>{$_("admin.users.col_role")}</Table.Head>
              <Table.Head>{$_("admin.users.col_status")}</Table.Head>
              <Table.Head class="text-right">{$_("admin.users.col_usage")}</Table.Head>
              <Table.Head>{$_("admin.users.col_created")}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each users as user (user.id)}
              {@const isSelf = me?.id === user.id}
              <Table.Row data-testid={`user-row-${user.id}`}>
                <Table.Cell class="text-sm">{user.email ?? "—"}</Table.Cell>
                <Table.Cell class="text-sm">{user.name ?? "—"}</Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-2" data-testid={`role-control-${user.id}`}>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                    {#if user.role === "admin"}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf}
                        title={isSelf ? $_("admin.users.cannot_modify_self") : ""}
                        onclick={() => handleChangeRole(user, "user")}
                        data-testid={`demote-${user.id}`}
                      >
                        {$_("admin.users.demote")}
                      </Button>
                    {:else}
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => handleChangeRole(user, "admin")}
                        data-testid={`promote-${user.id}`}
                      >
                        {$_("admin.users.promote")}
                      </Button>
                    {/if}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div class="flex items-center gap-2" data-testid={`status-control-${user.id}`}>
                    <Switch
                      checked={user.status === "active"}
                      disabled={isSelf}
                      title={isSelf ? $_("admin.users.cannot_modify_self") : ""}
                      onCheckedChange={(v: boolean) =>
                        handleToggleStatus(user, v ? "active" : "suspended")}
                    />
                    <Badge variant={user.status === "active" ? "secondary" : "destructive"}>
                      {user.status}
                    </Badge>
                  </div>
                </Table.Cell>
                <Table.Cell class="text-right text-sm tabular-nums">
                  <span data-testid={`usage-count-${user.id}`}>{user.usage_count}</span>
                  <span class="ml-1 text-xs text-muted-foreground">
                    ({user.total_chars} chars)
                  </span>
                </Table.Cell>
                <Table.Cell class="text-xs text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
    <p class="text-xs text-muted-foreground">
      {$_("admin.users.total_count", { values: { n: total } })}
    </p>
  {/if}
</div>
