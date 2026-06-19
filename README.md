# AI Translator

A privacy-first AI translation app built with SvelteKit. Sign in with Google or GitHub, bring your own provider API key (BYOK), and your translation history + glossary sync across devices via Supabase. Supports multiple AI providers and real-time streaming.

구글 또는 GitHub으로 로그인하는 AI 번역기. 번역 히스토리와 글로서리는 Supabase로 동기화되고, API 키는 브라우저에 안전하게 보관됩니다.

## Features

- **OAuth sign-in** — Google or GitHub (Supabase Auth). Account required.
- **Multi-provider support** — OpenAI, Google Gemini, Qwen, Z.AI (Zhipu), DeepSeek, and custom OpenAI-compatible endpoints
- **BYOK (Bring Your Own Key)** — Each user's provider API keys are stored in their own browser's localStorage (admin-managed keys: future phase)
- **Real-time streaming** — See translations appear token-by-token via SSE
- **Cloud-synced glossary** — Per-user custom term translations, stored in Supabase
- **Cloud-synced history** — Last 100 translations per user, with detail view
- **Auto language detection** — Source language auto-detected from input text
- **Dark mode** — System-aware with manual toggle, no flash of unstyled content (FOUC)
- **Custom prompts** — Override the default translation instruction per request
- **File upload** — Translate `.txt` files directly

## Tech Stack

| Layer          | Technology                                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| Framework      | SvelteKit 2 + Svelte 5 (runes mode, SPA)                                          |
| Styling        | Tailwind CSS 3 + shadcn-svelte                                                    |
| AI Integration | OpenAI SDK (custom baseURL for multi-provider)                                    |
| Backend        | Supabase (PostgreSQL + Auth + RLS)                                                |
| State          | Svelte stores (cloud-backed for history/glossary, localStorage for settings/BYOK) |
| Testing        | Vitest (406 tests) + Playwright (63 tests)                                        |
| Deployment     | Vercel (@sveltejs/adapter-vercel)                                                 |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- A free [Supabase](https://supabase.com) project

### Installation

```bash
git clone https://github.com/kimgooneya/ai-translator.git
cd ai-translator
npm install
```

### Supabase setup (required before first run)

1. **Create a project** at [supabase.com](https://supabase.com) (free tier covers this app easily).
2. **Apply the schema:** open `supabase/migrations/0001_init.sql` in the Supabase Dashboard → SQL Editor → run it. This creates `profiles`, `translation_history`, `glossaries`, `glossary_entries` tables with Row Level Security policies and a trigger that auto-provisions a profile + glossary on signup.
3. **Copy credentials:** Project Settings → API → copy "Project URL" and "anon public" key into a local `.env` file:

   ```bash
   cp .env.example .env
   # Then edit .env with your real values:
   # PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   # PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
   ```

   The anon key is safe to expose — RLS protects every table.

4. **Enable OAuth providers:** Supabase Dashboard → Authentication → Providers → enable Google and/or GitHub. For each:
   - Create an OAuth app at the provider ([Google Cloud Console](https://console.cloud.google.com/apis/credentials), [GitHub Developer Settings](https://github.com/settings/developers)).
   - Paste the provider's Client ID + Secret into Supabase.
   - Set the callback URL to `https://YOUR_PROJECT.supabase.co/auth/v1/callback` (Supabase shows the exact URL).

### Development

```bash
npm run dev
```

Open http://localhost:5173 — you'll be redirected to `/login`. Sign in with Google or GitHub to continue.

### Testing

```bash
npm run test          # Unit tests (Vitest, with Supabase mocked in-memory)
npm run check         # Type checking (svelte-check)
npm run build         # Production build
npm run test:e2e      # E2E (Playwright) — requires a real Supabase project connected; see note below
```

> **E2E note:** Playwright specs exercise the full OAuth + cloud-data round-trip and require a live Supabase project with at least one OAuth provider configured. Without real credentials, every page redirects to `/login` and the specs cannot run. Set up Supabase first, then `npm run test:e2e`.

## Usage

1. **Sign in** — Go to `/login`, choose Google or GitHub
2. **Add provider API key** — Go to /settings, select your provider, paste your API key (stored locally in your browser)
3. **Translate** — Go to /, enter source text, select target language, click Translate
4. **(Optional) Advanced options** — Enable custom prompt or glossary
5. **Glossary** — Lock specific term translations at /glossary (synced to your account)
6. **History** — Past translations saved at /history (synced to your account, last 100)

## Supported Providers

| Provider         | Get API Key                                 |
| ---------------- | ------------------------------------------- |
| OpenAI           | https://platform.openai.com/api-keys        |
| Google Gemini    | https://aistudio.google.com/apikey          |
| Qwen (DashScope) | https://dashscope.console.aliyun.com/apiKey |
| Z.AI (Zhipu)     | https://open.bigmodel.cn/usercenter/apikeys |
| DeepSeek         | https://platform.deepseek.com/api_keys      |

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
4. Add environment variables: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
5. Click Deploy

## Project Structure

```
src/
  lib/
    components/          # Svelte components (shadcn-svelte based)
    components/ui/       # Vendored shadcn-svelte primitives
    constants/           # UI strings, language list, error messages
    detect/              # Language auto-detection
    providers/           # Provider registry, translation logic
    schemas/             # Zod schemas + TypeScript types
    storage/             # localStorage persistence utilities (settings, theme)
    stores/              # Svelte stores (auth, settings, glossary, history, locale)
    streaming/           # SSE stream parser
    supabase/            # Supabase browser + server clients, typed Database
    utils.ts             # cn() class merge helper
  routes/
    api/translate/       # POST /api/translate (streaming endpoint)
    auth/callback/       # OAuth code-exchange callback
    glossary/            # /glossary (cloud-synced)
    history/             # /history (cloud-synced)
    login/               # /login (OAuth sign-in)
    settings/            # /settings (BYOK provider keys, local)
  hooks.server.ts        # Per-request Supabase session refresh + auth gate
supabase/
  migrations/            # SQL migrations (apply via Dashboard or `supabase db push`)
```

## Privacy

- **Provider API keys** (BYOK): stored in your browser's localStorage only, sent to the same-origin server proxy only during a translation request, never logged or sent to analytics.
- **Translation history + glossary**: stored in your Supabase account, protected by Row Level Security (each row is visible only to its owner). Supabase project owner has DB-level access — host your own Supabase instance if you need full self-hosting.
- **OAuth**: handled by Supabase Auth; this app never sees your Google/GitHub password.
- No telemetry, no tracking, no third-party analytics.

## Contributing

This is a personal project and I'm currently not accepting external pull requests. You're welcome to fork and modify under the MIT License. Bug reports via [Issues](https://github.com/kimgooneya/ai-translator/issues) are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
