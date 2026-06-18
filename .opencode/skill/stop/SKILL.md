---
name: stop
description: "Stop the project's running dev server — kills the `translator-dev` tmux window in the user's current session and verifies port 5173 is released. MUST USE whenever the user wants to stop the running server, shut down the dev server, kill the preview, or end the local dev session — e.g. 'stop the server', 'shut down the server', 'kill the dev server', 'stop previewing', 'end the dev session', '앱 꺼줘', '서버 꺼줘', '서버 종료', '미리보기 종료', 'dev 서버 멈춰', '서버 내려'."
---

# Stop — kill the running dev server

This is the project-specific counterpart to the `preview` skill. `preview` starts the Vite dev server in a `translator-dev` tmux window of the user's current session; `stop` tears that window down and confirms port 5173 is released.

**Scope:** stop ONLY kills the dev server. It does NOT close the debug Chrome window that `preview` opened (that profile persists at `~/.translator-debug-chrome` so the BYOK API key survives across preview sessions — see preview's notes). It does NOT kill Playwright e2e runs and does NOT delete any persisted state.

## Hardcoded project facts (must match `preview`)
- **Dev server window name:** `translator-dev` (a window in the user's current tmux session, created by `preview`)
- **Port:** `5173`
- **Dev command (for identification only — do NOT run it):** `npm run dev`

## ⚠️ Distinguish "our dev server" from "e2e run" or "stale process"

Port `5173` is shared with `npm run test:e2e` (Playwright auto-starts its own dev server there), and other stale processes can hold it too. **Never blindly `kill -9` a PID found via `lsof`** — that can corrupt a running e2e suite or kill an unrelated process. Always identify by window name first.

Before doing anything destructive, gather both signals:

```
SESS=$(tmux display-message -p '#{session_name}')
tmux list-windows -t "$SESS:" -F '#{window_name}' 2>/dev/null | grep -qx translator-dev && echo "window:exists" || echo "window:missing"
lsof -ti:5173 >/dev/null 2>&1 && echo "port:busy" || echo "port:free"
```

Then branch on the result:

| Window `translator-dev` | Port 5173 | Action |
|---|---|---|
| exists | (any) | Kill the window — that is our dev server. Then verify the port releases (step 3). |
| missing | busy | Do NOT kill anything. It is almost certainly a Playwright e2e run or a stale process. Report `lsof -i:5173` to the user and ask whether to stop it. |
| missing | free | Nothing is running. Report "dev server was not running" and exit. |

⚠️ The trailing `:` in `-t "$SESS:"` is **required** (same reason as in `preview`): `list-windows`'s `-t` takes a *window* target, and a bare numeric session name is read as a window index. Always use the colon form.

## Workflow

### 1. Identify the current tmux session
The opencode Bash tool runs inside the user's tmux session. Capture it (don't hardcode):

```
SESS=$(tmux display-message -p '#{session_name}')
```

### 2. Kill the dev server window (if it exists)

```
if tmux list-windows -t "$SESS:" -F '#{window_name}' | grep -qx translator-dev; then
  tmux kill-window -t "$SESS:translator-dev"
  echo "killed translator-dev"
else
  echo "no translator-dev window in session $SESS"
fi
```

`tmux kill-window` sends SIGHUP to the pane process tree, which Vite handles cleanly (no orphaned `npm`/`node`).

### 3. Verify port 5173 is released
Poll briefly after the kill (timeout ~5s — Vite releases the port almost immediately):

```
for i in $(seq 1 5); do
  lsof -ti:5173 >/dev/null 2>&1 || { echo "port free"; break; }
  sleep 1
done
```

If the window was killed but the port is still busy after 5s, a stale child process or a separately-started e2e run is holding it. **Do NOT `kill -9` arbitrary PIDs.** Report the holder to the user via `lsof -i:5173` and ask whether to stop it.

### 4. Report
Tell the user:
- the dev server has been stopped (or was not running to begin with)
- the port is free / still busy (with the holder detail if busy)
- the debug Chrome profile at `~/.translator-debug-chrome` is **preserved** (BYOK keys persist) — they can close the Chrome window manually if desired, or delete that directory to reset the profile.

## What this skill does NOT do
- Does NOT close the debug Chrome window opened by `preview` (profile is preserved for BYOK).
- Does NOT kill Playwright e2e processes or arbitrary PIDs found via `lsof` — those are reported to the user, who decides.
- Does NOT delete the BYOK localStorage, the debug Chrome profile, or any other persisted state.
- Does NOT restart the server — that's `preview`'s job. If the user wants to restart, run `stop` then `preview`.
