import { test, expect, type Page } from "@playwright/test";

// Managed-key translate flow: the client has NO api key concept. The provider
// catalog (models/baseURL) is served by GET /api/user/providers and the server
// resolves an encrypted key per request. These specs mock the catalog so the
// page can enable translation deterministically without a live backend.
//
// NOTE: like every e2e here, reaching "/" still requires a logged-in user
// (hooks.server.ts auth gate) — run against a real Supabase project.

const OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"];

function seedActiveOpenai(): void {
  // Managed-key settings shape: providerId + selectedModel only. No apiKey.
  localStorage.setItem(
    "translator.settings",
    JSON.stringify({
      providers: [{ providerId: "openai", selectedModel: "gpt-5.4-mini" }],
      activeProviderId: "openai",
      defaultTargetLang: "ko",
    }),
  );
}

async function mockCatalog(page: Page): Promise<void> {
  await page.route("**/api/user/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          {
            id: "openai",
            name: "OpenAI",
            kind: "preset",
            baseURL: "https://api.openai.com/v1",
            models: OPENAI_MODELS,
            defaultModel: "gpt-5.4-mini",
          },
        ],
      }),
    });
  });
}

test.describe("Translate page (managed-key)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.settings");
        localStorage.removeItem("translator.glossary");
      } catch {
        // ignore
      }
    });
  });

  test("renders source textarea, language selects, model select, and translate button", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.goto("/");

    await expect(page.getByTestId("source-textarea")).toBeVisible();
    await expect(page.getByTestId("source-lang-select")).toBeVisible();
    await expect(page.getByTestId("target-lang-select")).toBeVisible();
    await expect(page.getByTestId("model-select")).toBeVisible();
    await expect(page.getByTestId("translate-button")).toBeVisible();
    await expect(page.getByTestId("translate-button")).toHaveText("번역하기");
  });

  test("translate button is disabled when sourceText is empty", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");

    await expect(page.getByTestId("translate-button")).toBeDisabled();
  });

  test("translate button becomes enabled once a provider is active and text is entered", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");

    const btn = page.getByTestId("translate-button");
    await expect(btn).toBeDisabled();

    await page.getByTestId("source-textarea").fill("hello world");
    await expect(btn).toBeEnabled();
  });

  test("shows the no-provider warning with a settings link when no provider is active", async ({
    page,
  }) => {
    // No active provider in settings + catalog may be empty/absent.
    await mockCatalog(page);
    await page.goto("/");

    const warning = page.getByTestId("no-provider-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("활성 provider");
    const link = warning.locator('a[data-testid="warning-open-settings"]');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/settings");
  });

  test("clicking 고급 옵션 reveals custom prompt and glossary toggle", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");

    await expect(page.getByTestId("custom-prompt-input")).not.toBeVisible();
    await expect(page.getByTestId("glossary-toggle")).not.toBeVisible();

    await page.getByTestId("advanced-options-toggle").click();

    await expect(page.getByTestId("custom-prompt-input")).toBeVisible();
    await expect(page.getByTestId("glossary-toggle")).toBeVisible();

    await page.getByTestId("advanced-options-toggle").click();
    await expect(page.getByTestId("custom-prompt-input")).not.toBeVisible();
  });

  test("glossary toggle shows entry count", async ({ page }) => {
    await mockCatalog(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.glossary",
        JSON.stringify({
          enabled: false,
          entries: [{ id: "1", source: "RAG", target: "검색 증강 생성" }],
        }),
      );
    });
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");
    await page.getByTestId("advanced-options-toggle").click();

    await expect(page.getByTestId("advanced-options-content")).toContainText(
      "1개 용어",
    );
  });

  test("model dropdown shows the catalog models for the active provider", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");

    // bits-ui Select renders a <button> trigger + a Portal popover with
    // role="option" items (not a native <select>). Open, then enumerate.
    await page.getByTestId("model-select").click();
    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(4);
    const texts = (await options.allTextContents()).map((t) => t.trim());
    expect(texts).toEqual(OPENAI_MODELS);
  });

  test("clicking translate sends POST to /api/translate with a keyless body", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);

    let requestBody: Record<string, unknown> | null = null;
    await page.route("**/api/translate", async (route) => {
      requestBody = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "data: test\n\n",
      });
    });

    await page.goto("/");
    await page.getByTestId("source-textarea").fill("hello world");
    await page.getByTestId("translate-button").click();

    await expect.poll(() => requestBody).not.toBeNull();
    expect(requestBody).toMatchObject({
      sourceText: "hello world",
      sourceLang: "auto",
      targetLang: "ko",
      providerId: "openai",
      model: "gpt-5.4-mini",
    });
    // Managed-key contract: the body MUST NOT carry an apiKey.
    expect(requestBody).not.toHaveProperty("apiKey");
  });

  test("cancel button is not visible when not translating", async ({ page }) => {
    await mockCatalog(page);
    await page.addInitScript(seedActiveOpenai);
    await page.goto("/");
    await expect(page.getByTestId("cancel-button")).not.toBeVisible();
  });

  test("source language select defaults to 자동 감지", async ({ page }) => {
    await mockCatalog(page);
    await page.goto("/");
    await expect(page.getByTestId("source-lang-select")).toContainText(
      "자동 감지",
    );
  });

  test("target language select defaults to 한국어", async ({ page }) => {
    await mockCatalog(page);
    await page.goto("/");
    await expect(page.getByTestId("target-lang-select")).toContainText(
      "한국어",
    );
  });

  test.describe("streaming SSE response", () => {
    test("renders chunks incrementally into the result area", async ({
      page,
    }) => {
      await mockCatalog(page);
      await page.addInitScript(seedActiveOpenai);
      await page.route("**/api/translate", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: "data: 안\n\ndata: 녕\n\ndata: 하세요\n\ndata: [DONE]\n\n",
        });
      });

      await page.goto("/");
      await page.getByTestId("source-textarea").fill("hello");
      await page.getByTestId("translate-button").click();

      await expect(page.getByTestId("result-text")).toHaveText("안녕하세요", {
        timeout: 5000,
      });
      await expect(page.getByTestId("result-placeholder")).toBeHidden();
    });

    test("keeps the completed translation in the history store", async ({
      page,
    }) => {
      await mockCatalog(page);
      await page.addInitScript(seedActiveOpenai);
      await page.route("**/api/translate", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: "data: 안녕\n\ndata: [DONE]\n\n",
        });
      });

      await page.goto("/");
      await page.getByTestId("source-textarea").fill("hello");
      await page.getByTestId("translate-button").click();

      await expect(page.getByTestId("result-text")).toHaveText("안녕");
    });

    test("surfaces a Korean error toast on HTTP error", async ({ page }) => {
      await mockCatalog(page);
      await page.addInitScript(seedActiveOpenai);
      await page.route("**/api/translate", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: "INVALID_API_KEY",
            message: "API 키를 확인하세요",
          }),
        });
      });

      await page.goto("/");
      await page.getByTestId("source-textarea").fill("hello");
      await page.getByTestId("translate-button").click();

      const errorToast = page.locator(
        '[data-sonner-toast][data-type="error"]',
      );
      await expect(errorToast).toBeVisible({ timeout: 5000 });
      await expect(errorToast).toContainText("API 키를 확인하세요");
      await expect(page.getByTestId("result-text")).toBeHidden();
    });

    test("preserves partial result when a mid-stream error arrives", async ({
      page,
    }) => {
      await mockCatalog(page);
      await page.addInitScript(seedActiveOpenai);
      const payload = JSON.stringify({
        error: "STREAM_INTERRUPTED",
        message: "중단됨",
      });
      await page.route("**/api/translate", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: partial\n\nevent: error\ndata: ${payload}\n\n`,
        });
      });

      await page.goto("/");
      await page.getByTestId("source-textarea").fill("hello");
      await page.getByTestId("translate-button").click();

      const errorToast = page.locator(
        '[data-sonner-toast][data-type="error"]',
      );
      await expect(errorToast).toContainText("중단", { timeout: 5000 });
      await expect(page.getByTestId("result-text")).toHaveText("partial");
    });
  });
});
