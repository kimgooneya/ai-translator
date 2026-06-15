import { test, expect } from "@playwright/test";

test.describe("Translate page", () => {
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
    await page.goto("/");

    const btn = page.getByTestId("translate-button");
    await expect(btn).toBeDisabled();
  });

  test("translate button becomes enabled after entering source text (with API key)", async ({
    page,
  }) => {
    // Seed localStorage with a configured provider before navigating
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [
            {
              providerId: "openai",
              apiKey: "sk-e2e-key",
              selectedModel: "gpt-4o-mini",
            },
          ],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
        }),
      );
    });

    await page.goto("/");

    const btn = page.getByTestId("translate-button");
    await expect(btn).toBeDisabled();

    await page.getByTestId("source-textarea").fill("hello world");
    await expect(btn).toBeEnabled();
  });

  test("shows warning with settings link when no API key is configured", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [
            { providerId: "openai", apiKey: "", selectedModel: "gpt-4o-mini" },
          ],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
        }),
      );
    });

    await page.goto("/");

    const warning = page.getByTestId("no-api-key-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("API 키");
    await expect(warning.locator("a")).toHaveAttribute("href", "/settings");
  });

  test("shows warning when no active provider is set", async ({ page }) => {
    await page.goto("/");

    const warning = page.getByTestId("no-api-key-warning");
    await expect(warning).toContainText("활성 provider");
  });

  test("clicking 고급 옵션 reveals custom prompt and glossary toggle", async ({
    page,
  }) => {
    await page.goto("/");

    // Not visible initially
    await expect(page.getByTestId("custom-prompt-input")).not.toBeVisible();
    await expect(page.getByTestId("glossary-toggle")).not.toBeVisible();

    // Click to expand
    await page.getByTestId("advanced-options-toggle").click();

    await expect(page.getByTestId("custom-prompt-input")).toBeVisible();
    await expect(page.getByTestId("glossary-toggle")).toBeVisible();

    // Click again to collapse
    await page.getByTestId("advanced-options-toggle").click();
    await expect(page.getByTestId("custom-prompt-input")).not.toBeVisible();
  });

  test("glossary toggle shows entry count", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.glossary",
        JSON.stringify({
          enabled: false,
          entries: [{ id: "1", source: "RAG", target: "검색 증강 생성" }],
        }),
      );
    });

    await page.goto("/");
    await page.getByTestId("advanced-options-toggle").click();

    await expect(page.getByTestId("advanced-options-content")).toContainText(
      "1개 용어",
    );
  });

  test("model dropdown shows available models for the active provider", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [
            {
              providerId: "openai",
              apiKey: "sk-e2e-key",
              selectedModel: "gpt-5.4-mini",
            },
          ],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
        }),
      );
    });

    await page.goto("/");

    // bits-ui Select renders a <button> trigger (carrying the testid) +
    // opens a Portal-attached popover with `role="option"` items — NOT a
    // native <select> with <option> children. Click the trigger to open,
    // then enumerate options via role.
    const modelTrigger = page.getByTestId("model-select");
    await modelTrigger.click();

    const options = page.locator('[role="option"]');
    await expect(options).toHaveCount(4);
    // bits-ui Item renders text with surrounding whitespace; trim before
    // comparing so the assertion is against the model name itself.
    const texts = (await options.allTextContents()).map((t) => t.trim());
    expect(texts).toContain("gpt-5.5");
    expect(texts).toContain("gpt-5.4");
    expect(texts).toContain("gpt-5.4-mini");
    expect(texts).toContain("gpt-5.4-nano");
  });

  test("clicking translate sends POST to /api/translate with correct body", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [
            {
              providerId: "openai",
              apiKey: "sk-e2e-key",
              selectedModel: "gpt-5.4-mini",
            },
          ],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
        }),
      );
    });

    let requestBody: Record<string, unknown> | null = null;

    await page.route("**/api/translate", async (route) => {
      const request = route.request();
      requestBody = JSON.parse(request.postData() ?? "{}");
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
      apiKey: "sk-e2e-key",
      model: "gpt-5.4-mini",
    });
  });

  test("cancel button is not visible when not translating", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("cancel-button")).not.toBeVisible();
  });

  test("source language select defaults to 자동 감지", async ({ page }) => {
    await page.goto("/");
    // bits-ui Select.Trigger renders a <button> that displays the bound
    // value's label as text content (no native `.value` API). Assert on the
    // rendered text instead.
    const trigger = page.getByTestId("source-lang-select");
    await expect(trigger).toContainText("자동 감지");
  });

  test("target language select defaults to ko", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByTestId("target-lang-select");
    await expect(trigger).toContainText("한국어");
  });

  test.describe("streaming SSE response", () => {
    function seedSettings(): void {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [
            {
              providerId: "openai",
              apiKey: "sk-e2e-key",
              selectedModel: "gpt-5.4-mini",
            },
          ],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
        }),
      );
    }

    test("renders chunks incrementally into the result area", async ({
      page,
    }) => {
      await page.addInitScript(seedSettings);
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
      await expect(page.getByTestId("error-message")).toBeHidden();
    });

    test("saves the completed translation to localStorage history", async ({
      page,
    }) => {
      await page.addInitScript(seedSettings);
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

      await expect
        .poll(
          async () => {
            return page.evaluate(() =>
              localStorage.getItem("translator.history"),
            );
          },
          { timeout: 5000 },
        )
        .not.toBeNull();

      const stored = await page.evaluate(() =>
        localStorage.getItem("translator.history"),
      );
      const parsed = JSON.parse(stored ?? "[]") as Array<{
        response: string;
        providerName: string;
        modelName: string;
        request: { sourceText: string };
      }>;
      expect(parsed).toHaveLength(1);
      expect(parsed[0].response).toBe("안녕");
      expect(parsed[0].providerName).toBe("OpenAI");
      expect(parsed[0].modelName).toBe("gpt-5.4-mini");
      expect(parsed[0].request.sourceText).toBe("hello");
    });

    test("surfaces a Korean error toast on HTTP error", async ({ page }) => {
      await page.addInitScript(seedSettings);
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

      // Sonner DOM: <li data-sonner-toast data-type="error">…<div data-title>
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
      await page.addInitScript(seedSettings);
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
