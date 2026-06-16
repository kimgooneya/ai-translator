---
name: preview
description: "Run this project's dev server (npm run dev on http://localhost:5173) and open it in a dedicated Chrome browser for live debugging/inspection. MUST USE whenever the user wants to see the running app, preview it, open it in a browser, run the server and show the page, or debug the UI in Chrome — e.g. 'open the app', 'show me the app', 'run the server', 'launch the app', 'debug in chrome', 'preview the translator', '앱 켜줘', '서버 켜고 보여줘', '크롬으로 디버깅', '미리보기'."
---

# Preview — run the dev server and open it in a dedicated Chrome

This is a project-specific skill for THIS repo (the AI translator). It starts the Vite dev server and opens a single dedicated, isolated Chrome window (separate profile) so the user can see and interact with the running app.

**Scope:** preview ONLY launches the dev server + a user-facing debug Chrome. It does NOT drive Playwright MCP — automated inspection (screenshots, console reads, DOM snapshots) is a separate concern the agent invokes on demand when actually needed. Do not spawn a Playwright browser as part of this skill.

## Hardcoded project facts (edit here if they change)
- **Dev command:** `npm run dev` (Vite dev server)
- **URL:** `http://localhost:5173`
- **App type:** SPA, SSR disabled (`ssr = false`) — the page mounts client-side, so after the Chrome window opens, allow ~1-2s of render time before the user interacts. (No automated wait is performed by this skill.)
- **Routes:** `/` (translate), `/settings`, `/glossary`, `/history`.
- **BYOK:** exercising a real translation needs an API key stored in localStorage at `/settings`. For pure visual/debug inspection it is not required.

## ⚠️ Port conflict with Playwright e2e (important)
`5173` is also the port `npm run test:e2e` uses, and Playwright **auto-starts its own dev server** there. Before starting anything, check what's on the port:

```
lsof -ti:5173
```

- If the port is busy **because e2e is running** (`npm run test:e2e`), do NOT start a second dev server and do NOT assume the running server is a clean dev instance — tell the user e2e is occupying the port and ask whether to stop it.
- If the port is busy with a normal `npm run dev` (ours), reuse it — skip straight to opening the browser.
- If the port is free, start the server (step 1).

## Workflow

### 1. Start the dev server in a new tmux window of the CURRENT session (only if not already running)
The dev server should run in a **new window of the user's current tmux session** — NOT a separate detached session — so it sits alongside their other windows and they can reach it with normal tmux navigation. The opencode Bash tool already runs inside the user's tmux session, so "current session" is the right target. (Verify: `tmux display-message -p '#{session_name}'` should print the user's session, e.g. `2`.)

Capture the current session name (don't hardcode it):

```
SESS=$(tmux display-message -p '#{session_name}')
```

Start the server in a detached new window named `translator-dev` (`-d` so it does NOT steal focus from whatever the user is doing):

```
tmux new-window -t "$SESS:" -d -n translator-dev "npm run dev"
```

⚠️ The trailing `:` in `-t "$SESS:"` is **required**. `new-window`'s `-t` takes a *window* target, and a bare number is read as a window index. The user's session is named `2`, so `-t "$SESS"` (→ `-t 2`) means "window index 2" and fails with `create window failed: index 2 in use`. `-t "$SESS:"` (→ `-t 2:`) means "session 2, new window" — always use the colon form here, even for non-numeric session names.

Wait for readiness — poll until the server responds (timeout ~30s):

```
for i in $(seq 1 30); do curl -sf http://localhost:5173 >/dev/null && echo "ready" && break; sleep 1; done
```

To inspect server logs later:

```
tmux capture-pane -p -t "$SESS:translator-dev"
```

To stop it:

```
tmux kill-window -t "$SESS:translator-dev"
```

Keep the server running across the session — do not kill the window unless the user asks.

**Critical:** use `new-window` (a window in the current session), NOT `new-session` (which creates a hidden separate session and breaks the user's "everything in my current session" workflow). Only start the server if port 5173 is free (see the port-conflict check above) — if it's already running, reuse it and do NOT create a second window.

### 2. Open a visible, isolated Chrome window (debug profile) for the user
The user wants to SEE the running app in a clean, dedicated browser that is isolated from their everyday Chrome: separate profile → no interference with their logged-in sessions, extensions, or bookmarks. It also matters for THIS app specifically — BYOK keys live in `localStorage`, so the dev API key is stored in the debug profile and never leaks into (or gets overwritten by) the user's main browser.

Launch Chrome with a dedicated `--user-data-dir`:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --user-data-dir="$HOME/.translator-debug-chrome" \
  --no-first-run --no-default-browser-check \
  --window-size=1280,900 \
  "http://localhost:5173" >/dev/null 2>&1 &
disown
```

Why this exact form:
- `--user-data-dir` is what makes it a separate debug profile. If that profile isn't running yet, this launches a fresh isolated Chrome. If it IS already running, Chrome hands the URL off to that instance (opens a new tab/window in it) and the spawned process exits — so re-running the skill just focuses the existing debug browser instead of spawning duplicates or hitting a profile-lock error.
- Launching the binary directly (NOT `open -a …`) is required: `open` reuses the user's main Chrome instance and silently ignores `--user-data-dir`. Do NOT use `open` here, and do NOT use AppleScript `make new window` (that also targets the main instance).
- `--no-first-run --no-default-browser-check` suppress the welcome / make-default-browser prompts.
- `&` + `disown` with redirected output detaches the browser so the shell returns immediately and the process survives the tmux/shell session.

Notes:
- The profile persists at `~/.translator-debug-chrome` — that's a feature: the BYOK API key entered once at `/settings` is remembered across previews. Delete that directory to reset the debug profile.
- Requires Google Chrome at `/Applications/Google Chrome.app`. If Chrome lives elsewhere, adjust the path.

### 3. Report
Tell the user:
- the app is live at `http://localhost:5173` (Chrome opened to it)
- the running route (default `/`)
- how to stop: `tmux kill-window -t "$(tmux display-message -p '#{session_name}'):translator-dev"`

Do NOT auto-launch Playwright MCP, take screenshots, or read console messages as part of preview. If the user wants visual verification or you need to inspect the rendered page, invoke Playwright MCP separately and on demand after preview has set up the server + debug Chrome.

## What this skill does NOT do
- Does not run the production build (`npm run build` + `vite preview`). This is dev-mode debugging only — ask if a prod preview is needed.
- Does not seed an API key. If the user wants to actually test translation end-to-end, point them to `/settings` (BYOK) or ask before injecting anything into localStorage.
- Does not run Playwright e2e — those auto-manage their own server and live in `tests/`.
- Does not drive Playwright MCP — automation/inspection is a separate concern, invoked on demand when needed.
