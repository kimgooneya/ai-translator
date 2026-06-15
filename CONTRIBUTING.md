# Contributing

Thank you for your interest in contributing to AI Translator! This document provides guidelines for developers who want to contribute to this project.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/kimgooneya/ai-translator.git
cd ai-translator

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 to view the app.

## Workflow

### 1. Fork and Branch

1. Fork the repository on GitHub
2. Clone your fork locally
3. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

### 2. Development

- Make your changes following the project's code style
- Test your changes locally
- Ensure all existing tests still pass

### 3. Testing Requirements

Before committing, ensure all tests pass:

```bash
# Type checking
npm run check

# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

All tests must pass before any pull request is created.

### 4. Commit Messages

Use semantic commit messages following the project's convention:

```bash
# Feature addition
git commit -m "feat: add new translation provider support"

# Bug fix
git commit -m "fix: resolve language detection edge case"

# Documentation
git commit -m "docs: update README with installation instructions"

# Refactoring
git commit -m "refactor: optimize stream parsing performance"
```

### 5. Push and PR

```bash
git push origin feature/your-feature-name
```

Create a pull request on GitHub with:
- Clear title describing the changes
- Detailed description of what was changed and why
- Any relevant screenshots or test results
- Link to any related issues

## Code Style

### Svelte 5 Runes

This project uses Svelte 5 with runes mode. Follow these guidelines:

- Use `$` prefix for reactive state
- Prefer reactive statements over `onMount` where possible
- Use `derived` for computed values
- Follow Svelte 5 migration best practices

### shadcn-svelte Components

The project uses shadcn-svelte for UI components:

- Use the provided component primitives from `src/lib/components/ui/`
- Follow the component naming conventions
- Customize components through props rather than direct modification

### TypeScript

- Strict TypeScript mode enabled
- Use proper type annotations
- Avoid `any` type - use specific types
- Use interfaces and type aliases for complex types

## Testing

### Unit Tests (Vitest)

- Write tests for all new features
- Mock external dependencies
- Test both success and error cases
- Aim for 80%+ test coverage

```typescript
// Example test
import { describe, it, expect } from 'vitest';
import { translate } from '$lib/services/translation';

describe('translation service', () => {
  it('should translate text using OpenAI', async () => {
    const result = await translate('Hello', 'en', 'ko');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

### E2E Tests (Playwright)

- Test user workflows end-to-end
- Test different browsers and devices
- Test error scenarios and edge cases

```typescript
// Example E2E test
import { test, expect } from 'playwright/test';

test('should translate text', async ({ page }) => {
  await page.goto('/');
  await page.fill('textarea', 'Hello world');
  await page.selectOption('select', 'ko');
  await page.click('button:has-text("Translate")');
  await expect(page.locator('.translation-result')).toContainText('안녕하세요');
});
```

## Adding New AI Providers

To add a new AI provider:

1. **Update Provider Registry** (`src/lib/providers/index.ts`):
   - Add new provider configuration
   - Include authentication method
   - Define API endpoint

2. **Add Provider Preset** (`src/lib/constants/provider-presets.ts`):
   - Add provider-specific settings
   - Include default model name
   - Set up authentication configuration

3. **Update UI** (`src/routes/settings/+page.svelte`):
   - Add provider option to dropdown
   - Include provider-specific instructions

4. **Update README**:
   - Add provider to supported providers table
   - Include API key acquisition link

5. **Write Tests**:
   - Unit tests for provider logic
   - E2E tests for provider workflow

Example provider addition:

```typescript
// src/lib/providers/index.ts
export const providers = {
  openai: { /* existing config */ },
  gemini: { /* existing config */ },
  newProvider: {
    name: 'New Provider',
    apiKeyRequired: true,
    endpoint: 'https://api.newprovider.com/v1',
    models: ['model-1', 'model-2'],
    auth: { type: 'bearer' }
  }
};
```

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Environment Information**:
   - Node.js version
   - npm version
   - Browser (for frontend issues)
   - Operating system

2. **Steps to Reproduce**:
   - Detailed steps to reproduce the issue
   - Expected vs actual behavior
   - Screenshots if applicable

3. **Error Information**:
   - Full error message (if any)
   - Stack trace
   - Browser console logs

4. **Context**:
   - Which provider you were using
   - Input text and target language
   - Any custom configurations

### Feature Requests

For feature requests:

1. **Clear Description**: What you want to achieve
2. **Use Case**: Why this feature is needed
3. **Proposed Solution**: How you think it should work
4. **Alternatives**: Any alternative solutions considered

## Getting Help

- Check existing issues on GitHub
- Read the documentation in README.md
- Look at the existing code examples
- Ask questions in GitHub Discussions

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Please be respectful and inclusive in all interactions. Follow the project's code of conduct as outlined in the repository's guidelines.