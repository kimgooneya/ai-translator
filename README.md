# AI Translator

A privacy-first AI translation app built with SvelteKit. Sign in with Google or GitHub, pick from the admin-curated provider catalog, and translate with real-time streaming. Provider API keys are **managed centrally by an admin** — users never handle keys. Translation history and glossary sync across devices via Supabase.

구글 또는 GitHub으로 로그인하는 AI 번역기. 사용자는 어드민이 등록한 프로바이더 목록에서 선택만 하면 되며, API 키는 관리자가 중앙에서 암호화해 관리합니다. 번역 히스토리와 글로서리는 Supabase로 동기화됩니다.

## Features

- **OAuth sign-in** — Google or GitHub (Supabase Auth). Account required.
- **Managed provider keys** — The admin registers each provider's API key once (encrypted AES-256-GCM in Supabase); users just pick a provider + model and translate. No key handling for end users.
- **Multi-provider catalog** — OpenAI, Google Gemini, Qwen, Z.AI (Zhipu), DeepSeek, Anthropic Claude (admin-editable catalog, sourced from the `provider_presets` table)
- **Real-time streaming** — See translations appear token-by-token via SSE
- **Cloud-synced glossary** — Per-user custom term translations, stored in Supabase
- **Cloud-synced history** — Last 100 translations per user, with detail view
- **Auto language detection** — Source language auto-detected from input text
- **Dark mode** — System-aware with manual toggle, no flash of unstyled content (FOUC)
- **Custom prompts** — Override the default translation instruction per request
- **File upload** — Translate `.txt`/`.pdf` files directly
- **Admin console** — `/admin` dashboard for provider/key management, users, and usage stats (role-gated)

## Tech Stack

| Layer          | Technology                                                                            |
| -------------- | ------------------------------------------------------------------------------------- |
| Framework      | SvelteKit 2 + Svelte 5 (runes mode, SPA)                                              |
| Styling        | Tailwind CSS 3 + shadcn-svelte                                                        |
| AI Integration | OpenAI SDK (custom `baseURL` per provider, server-side only)                          |
| Backend        | Supabase (PostgreSQL + Auth + RLS)                                                    |
| Key security   | AES-256-GCM encryption (`ENCRYPTION_KEY`), decrypted only in `/api/translate` memory  |
| State          | Svelte stores (cloud-backed for history/glossary, localStorage for UI settings only)  |
| Testing        | Vitest (unit) + Playwright (e2e)                                                      |
| Deployment     | Vercel (@sveltejs/adapter-vercel)                                                     |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) project (free tier works)

### Installation

```bash
git clone https://github.com/kimgooneya/ai-translator.git
cd ai-translator
npm install
```

### Supabase setup (required before first run)

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Apply the schema migrations in order** via the Supabase Dashboard → SQL Editor:
   - Run `supabase/migrations/0001_init.sql` — creates `profiles`, `translation_history`, `glossaries`, `glossary_entries` tables with Row Level Security policies and a trigger that auto-provisions a profile + glossary on signup.
   - Run `supabase/migrations/0002_admin_managed_keys.sql` — adds `profiles.status` and the managed-key tables (`provider_presets`, `provider_keys`, `usage_logs`) with RLS. (Apply **after** `0001_init.sql`.)
   - Run `supabase/seed-presets.sql` — seeds the 6 default provider presets into `provider_presets` (`on conflict do nothing`, so it's safe to re-run).
3. **Enable OAuth providers:** Supabase Dashboard → Authentication → Providers → enable Google and/or GitHub. For each:
   - Create an OAuth app at the provider ([Google Cloud Console](https://console.cloud.google.com/apis/credentials), [GitHub Developer Settings](https://github.com/settings/developers)).
   - Paste the provider's Client ID + Secret into Supabase.
   - Set the callback URL to `https://YOUR_PROJECT.supabase.co/auth/v1/callback` (Supabase shows the exact URL).
4. **Copy credentials into `.env`:**

   ```bash
   cp .env.example .env
   ```

   Then fill in all four values (see `.env.example` for which are server-only):
   - `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` — from Project Settings → API. The anon key is browser-safe (RLS protects every table).
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS (used for `provider_keys` reads + `usage_logs` inserts). **Never expose to the browser.**
   - `ENCRYPTION_KEY` — base64-encoded 32-byte key for AES-256-GCM. Generate one:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```

### Admin setup (required to enable translation)

Translation can't work until an admin has added at least one provider API key. Bootstrap the **first** admin manually (there's no admin UI for first-admin — chicken/egg):

1. Sign in once via OAuth so your `profiles` row exists.
2. In the Supabase Dashboard → SQL Editor, promote yourself:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Sign out and back in (the role is read from your profile on each request).
4. Go to **`/admin/providers`** → open a provider → paste its API key (stored encrypted). Repeat for each provider you want enabled.

### Development

```bash
npm run dev
```

Open http://localhost:5173 — you'll be redirected to `/login`. Sign in with Google or GitHub to continue.

> **Local `.env` is required** for `npm run check` and `npm run test` — the crypto suite (`src/lib/server/crypto.ts`) imports `ENCRYPTION_KEY` at module load and validates it is a base64 32-byte value.

### Testing

```bash
npm run test          # Unit tests (Vitest, Supabase mocked in-memory)
npm run check         # Type checking (svelte-check)
npm run build         # Production build
npm run test:e2e      # E2E (Playwright) — requires a live Supabase project; see note below
```

> **E2E note:** Playwright specs exercise the full OAuth + cloud-data round-trip and need a live Supabase project with at least one OAuth provider configured **and** at least one admin-added provider key. Without those, every page redirects to `/login` (or shows the no-provider warning) and the specs cannot run. Set up Supabase + an admin key first, then `npm run test:e2e`.

## Usage

1. **Sign in** — `/login`, choose Google or GitHub
2. **Pick a provider** — `/settings`, choose from the admin-managed catalog (keys are handled by the admin — you don't enter any)
3. **Translate** — `/`, enter source text, select target language, click Translate
4. **(Optional) Advanced options** — Enable custom prompt or glossary
5. **Glossary** — Lock specific term translations at `/glossary` (synced to your account)
6. **History** — Past translations saved at `/history` (synced to your account, last 100)

## Admin console

Admins (`profiles.role = 'admin'`) get access to `/admin`:

- **`/admin`** — Dashboard: user/translation/provider-key health overview
- **`/admin/providers`** — Edit the provider catalog (preset models, base URL, enabled flag) and manage each provider's encrypted API keys (rotation/failover supported; only a masked `key_hint` is ever surfaced)
- **`/admin/users`** — View users, promote/demote roles, suspend/reactivate accounts
- **`/admin/stats`** — 7-day usage and per-provider breakdown

Admin routes are double-guarded: `hooks.server.ts` 404s any `/admin/*` or `/api/admin/*` request whose profile isn't an admin, and the `(admin)` layout's `+layout.server.ts` re-checks before render. Non-admins see a 404 (not a redirect) so the routes' existence isn't leaked.

## Environment variables

| Variable                    | Scope     | Purpose                                                                 |
| ---------------------------- | --------- | ----------------------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`        | browser   | Supabase project URL                                                    |
| `PUBLIC_SUPABASE_ANON_KEY`   | browser   | Supabase anon key (RLS-protected; safe to expose)                       |
| `SUPABASE_SERVICE_ROLE_KEY`  | server    | Bypasses RLS — `provider_keys` reads + `usage_logs` inserts. Never ship to the browser bundle. |
| `ENCRYPTION_KEY`             | server    | Base64 32-byte AES-256-GCM master key. Rotating it requires re-adding every provider key. |

Server-only vars are imported via `$env/static/private` from `src/lib/server/**` only, so Vite never bundles them for the client.

## Deployment (Vercel)

This project uses @sveltejs/adapter-vercel.

### Option A: Vercel CLI

```bash
npm i -g vercel
vercel          # Preview deploy
vercel --prod   # Production deploy
```

### Option B: Git Integration

1. Push your repository to GitHub
2. In Vercel dashboard: New Project, select your repo
3. Framework Preset: SvelteKit (auto-detected)
4. Add **all four** environment variables (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ENCRYPTION_KEY`)
5. Click Deploy
6. After deploy, bootstrap the first admin and add provider keys (see **Admin setup** above)

## Project Structure

```
src/
  hooks.server.ts            # Auth gate (session refresh + /admin guard → 404 for non-admins)
  lib/
    server/                  # SERVER-ONLY (never imported by client code)
      crypto.ts              # AES-256-GCM encryptKey/decryptKey (ENCRYPTION_KEY)
      supabase-admin.ts      # service_role client (bypasses RLS)
      provider-keys.ts       # getEnabledPreset / resolveActiveKey (decrypt in memory)
    components/              # Svelte components (shadcn-svelte based)
    components/ui/           # Vendored shadcn-svelte primitives
    constants/               # UI strings, language list, error-code → message map
    detect/                  # Language auto-detection
    providers/               # OpenAI SDK client factory + streamTranslation
    schemas/                 # Zod schemas + TypeScript types (no apiKey field)
    storage/                 # localStorage persistence utilities (settings, theme)
    stores/                  # Svelte stores (auth, settings, glossary, history, locale, providerCatalog)
    streaming/               # SSE stream parser
    supabase/                # Supabase browser + server clients, typed Database
  routes/
    (app)/                   # Authenticated user app (translate, settings, glossary, history)
      +layout.svelte         # Loads the provider catalog on mount
    (auth)/                  # Login + OAuth callback (public)
    (admin)/                 # Admin-only UI (dashboard, providers, users, stats)
    api/
      translate/             # POST /api/translate (managed-key SSE endpoint)
      user/providers/        # GET — provider catalog for users (no key material)
      admin/                 # /api/admin/* (providers, provider-keys, users, stats)
supabase/
  migrations/                # 0001_init.sql, 0002_admin_managed_keys.sql
  seed-presets.sql           # seeds the 6 default provider_presets
```

## Privacy

- **Provider API keys** are stored **encrypted at rest** (AES-256-GCM) in Supabase's `provider_keys` table and decrypted **only** inside the `/api/translate` server handler, in memory, for the duration of one request. They are never logged, never sent to analytics, and never reach the browser. The admin (project owner) holds the `SUPABASE_SERVICE_ROLE_KEY` and the `ENCRYPTION_KEY` — host your own Supabase + rotate these if you need full self-hosting.
- **Users never handle API keys.** They only pick a provider + model from the admin-curated catalog.
- **Translation history + glossary** are stored in your Supabase account, protected by Row Level Security (each row is visible only to its owner).
- **Usage telemetry** (`usage_logs`) records per-translation volume/status for the admin stats dashboard; readable by the owner and by admins only.
- **OAuth** is handled by Supabase Auth; this app never sees your Google/GitHub password.
- No telemetry, no tracking, no third-party analytics.

## Contributing

This is a personal project and I'm currently not accepting external pull requests. You're welcome to fork and modify under the MIT License. Bug reports via [Issues](https://github.com/kimgooneya/ai-translator/issues) are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
