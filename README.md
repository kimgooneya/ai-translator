# AI Translator

A privacy-first AI translation app built with SvelteKit. Bring your own API key (BYOK) — keys never leave your browser's localStorage. Supports multiple AI providers, real-time streaming, custom glossaries, and translation history.

프라이버시 중심 AI 번역기. API 키는 브라우저 localStorage에만 저장되고 서버에 전송되지 않습니다.

## Features

- **Multi-provider support** — OpenAI, Google Gemini, Qwen, Z.AI (Zhipu), DeepSeek, and custom OpenAI-compatible endpoints
- **BYOK (Bring Your Own Key)** — API keys stored in browser localStorage, never sent to any server (except the same-origin proxy during translation requests)
- **Real-time streaming** — See translations appear token-by-token via SSE
- **Custom glossary** — Lock specific term translations
- **Translation history** — Last 100 translations, with detail view
- **Auto language detection** — Source language auto-detected from input text
- **Dark mode** — System-aware with manual toggle, no flash of unstyled content (FOUC)
- **Custom prompts** — Override the default translation instruction per request
- **File upload** — Translate `.txt` files directly

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit 2 + Svelte 5 (runes mode) |
| Styling | Tailwind CSS 3 + shadcn-svelte |
| AI Integration | OpenAI SDK (custom baseURL for multi-provider) |
| State | Svelte stores + localStorage persistence |
| Testing | Vitest (375 tests) + Playwright (57 tests) |
| Deployment | Vercel (@sveltejs/adapter-vercel) |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
git clone https://github.com/kimgooneya/ai-translator.git
cd ai-translator
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

### Testing

```bash
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run check         # Type checking (svelte-check)
npm run build         # Production build
```

## Usage

1. **Add API key** — Go to /settings, select your provider, paste your API key
2. **Translate** — Go to /, enter source text, select target language, click Translate
3. **(Optional) Advanced options** — Enable custom prompt or glossary
4. **History** — Past translations saved at /history

## Supported Providers

| Provider | Get API Key |
|----------|------------|
| OpenAI | https://platform.openai.com/api-keys |
| Google Gemini | https://aistudio.google.com/apikey |
| Qwen (DashScope) | https://dashscope.console.aliyun.com/apiKey |
| Z.AI (Zhipu) | https://open.bigmodel.cn/usercenter/apikeys |
| DeepSeek | https://platform.deepseek.com/api_keys |

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
4. Click Deploy

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
    storage/             # localStorage persistence utilities
    stores/              # Svelte stores (settings, glossary, history)
    streaming/           # SSE stream parser
    utils.ts             # cn() class merge helper
  routes/
    api/translate/       # POST /api/translate (streaming endpoint)
    settings/            # /settings
    glossary/            # /glossary
    history/             # /history
```

## Privacy

- API keys stored in browser localStorage only — never sent to analytics servers
- Translation requests go through a same-origin server proxy (POST /api/translate)
- No telemetry, no tracking, no analytics

## Contributing

This is a personal project and I'm currently not accepting external pull requests. You're welcome to fork and modify under the MIT License. Bug reports via [Issues](https://github.com/kimgooneya/ai-translator/issues) are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

MIT
