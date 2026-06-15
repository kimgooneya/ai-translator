import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    // Isolate localStorage per test
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.settings");
      } catch {
        // ignore
      }
    });
  });

  test("renders the security notice mentioning localStorage", async ({
    page,
  }) => {
    await page.goto("/settings");
    const notice = page.getByTestId("security-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("localStorage");
  });

  test("renders all 5 preset provider cards by name", async ({ page }) => {
    await page.goto("/settings");
    const cards = page.getByTestId("provider-card");
    await expect(cards).toHaveCount(5);
    for (const name of [
      "OpenAI",
      "Google Gemini",
      "Qwen (DashScope)",
      "Zhipu Z.AI",
      "DeepSeek",
    ]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
  });

  test("saves an API key to localStorage when a preset card is saved", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Type an API key into the first (OpenAI) card
    const firstCard = page.getByTestId("provider-card").first();
    await firstCard.getByTestId("api-key-input").fill("sk-e2e-test-key");
    await firstCard.getByTestId("save-button").click();

    // localStorage should now contain the key
    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: "openai",
          apiKey: "sk-e2e-test-key",
        }),
      ]),
    );
  });

  test("add custom provider via form and see it appear in the list", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("provider-card")).toHaveCount(5);

    await page.getByTestId("add-name-input").fill("MyProvider");
    await page
      .getByTestId("add-base-url-input")
      .fill("https://api.test.com/v1");
    await page.getByTestId("add-models-input").fill("m1, m2");
    await page.getByTestId("add-submit-button").click();

    // Card appears
    await expect(page.getByTestId("provider-card")).toHaveCount(6);
    await expect(page.getByText("MyProvider", { exact: true })).toBeVisible();

    // Custom card has a delete button (presets do not)
    const customCard = page.locator(
      '[data-testid="provider-card"][data-provider-id="MyProvider"]',
    );
    await expect(customCard.getByTestId("delete-button")).toBeVisible();
  });

  test("shows a Korean error when submitting the add form with an empty name", async ({
    page,
  }) => {
    await page.goto("/settings");

    await page
      .getByTestId("add-base-url-input")
      .fill("https://api.test.com/v1");
    await page.getByTestId("add-models-input").fill("m1");
    await page.getByTestId("add-submit-button").click();

    await expect(page.getByTestId("error-name")).toHaveText(
      "이름을 입력하세요.",
    );
    await expect(page.getByTestId("provider-card")).toHaveCount(5);
  });

  test("removes a custom provider after confirming deletion", async ({
    page,
  }) => {
    await page.goto("/settings");

    // Add a custom provider first
    await page.getByTestId("add-name-input").fill("Deletable");
    await page.getByTestId("add-base-url-input").fill("https://api.del.com/v1");
    await page.getByTestId("add-models-input").fill("m1");
    await page.getByTestId("add-submit-button").click();
    await expect(page.getByTestId("provider-card")).toHaveCount(6);

    const customCard = page.locator(
      '[data-testid="provider-card"][data-provider-id="Deletable"]',
    );

    const dialogMessage = new Promise<string>((resolve) => {
      page.on("dialog", async (dialog) => {
        resolve(await dialog.message());
        await dialog.accept();
      });
    });
    await customCard.getByTestId("delete-button").click();
    expect(await dialogMessage).toContain("삭제");

    await expect(page.getByTestId("provider-card")).toHaveCount(5);
    await expect(page.getByText("Deletable", { exact: true })).toHaveCount(0);
  });
});
