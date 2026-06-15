import { test, expect } from "@playwright/test";

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.settings");
      } catch {
        // ignore
      }
    });
  });

  test("renders the security notice mentioning localStorage", async ({ page }) => {
    await page.goto("/settings");
    const notice = page.getByTestId("security-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("localStorage");
  });

  test("renders the provider table with 5 presets", async ({ page }) => {
    await page.goto("/settings");
    const table = page.getByTestId("provider-table");
    await expect(table).toBeVisible();

    for (const name of [
      "OpenAI",
      "Google Gemini",
      "Qwen (DashScope)",
      "Zhipu Z.AI",
      "DeepSeek",
    ]) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByTestId("provider-row")).toHaveCount(5);
  });

  test("shows 미설정 on all presets initially", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("미설정").first()).toBeVisible();
  });

  test("saves an API key to localStorage via edit drawer", async ({ page }) => {
    await page.goto("/settings");

    const editButtons = page.getByTestId("edit-button");
    await editButtons.first().click();

    const drawer = page.getByTestId("edit-provider-drawer");
    await expect(drawer).toBeVisible();

    await page.getByTestId("api-key-input").fill("sk-e2e-test-key");
    await page.getByTestId("save-button").click();

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

  test("add custom provider via modal and see it appear in the table", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("provider-row")).toHaveCount(5);

    await page.getByTestId("add-provider-button").click();
    const modal = page.getByTestId("add-provider-modal");
    await expect(modal).toBeVisible();

    await page.getByTestId("add-name-input").fill("MyProvider");
    await page.getByTestId("add-base-url-input").fill("https://api.test.com/v1");
    await page.getByTestId("add-models-input").fill("m1, m2");
    await page.getByTestId("add-submit-button").click();

    await expect(page.getByTestId("provider-row")).toHaveCount(6);
    await expect(page.getByText("MyProvider", { exact: true }).first()).toBeVisible();
  });

  test("shows a Korean error when submitting the add modal with an empty name", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("add-provider-button").click();
    await page.getByTestId("add-base-url-input").fill("https://api.test.com/v1");
    await page.getByTestId("add-models-input").fill("m1");
    await page.getByTestId("add-submit-button").click();

    await expect(page.getByTestId("error-name")).toHaveText("이름을 입력하세요.");
    await expect(page.getByTestId("provider-row")).toHaveCount(5);
  });

  test("edits and saves a custom provider API key, then deletes it with confirm", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("add-provider-button").click();
    await page.getByTestId("add-name-input").fill("Deletable");
    await page.getByTestId("add-base-url-input").fill("https://api.del.com/v1");
    await page.getByTestId("add-models-input").fill("m1");
    await page.getByTestId("add-submit-button").click();

    await expect(page.getByTestId("provider-row")).toHaveCount(6);

    const customRow = page.locator(
      '[data-testid="provider-row"][data-provider-id="Deletable"]',
    );
    await customRow.getByTestId("edit-button").click();

    await expect(page.getByTestId("edit-provider-drawer")).toBeVisible();
    await page.getByTestId("api-key-input").fill("sk-custom-key");
    await page.getByTestId("save-button").click();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: "Deletable",
          apiKey: "sk-custom-key",
        }),
      ]),
    );

    await customRow.getByTestId("edit-button").click();
    await expect(page.getByTestId("delete-button")).toBeVisible();

    const dialogMessage = new Promise<string>((resolve) => {
      page.on("dialog", async (dialog) => {
        resolve(await dialog.message());
        await dialog.accept();
      });
    });
    await page.getByTestId("delete-button").click();
    expect(await dialogMessage).toContain("삭제");

    await expect(page.getByTestId("provider-row")).toHaveCount(5);
    await expect(page.getByText("Deletable", { exact: true })).toHaveCount(0);
  });

  test("sets active provider via table button", async ({ page }) => {
    await page.goto("/settings");

    const openaiRow = page.locator(
      '[data-testid="provider-row"][data-provider-id="openai"]',
    );
    await openaiRow.getByTestId("edit-button").click();
    await page.getByTestId("api-key-input").fill("sk-active-test");
    await page.getByTestId("save-button").click();

    const geminiRow = page.locator(
      '[data-testid="provider-row"][data-provider-id="gemini"]',
    );
    await geminiRow.getByTestId("set-active-button").click();

    await expect(geminiRow.getByTestId("active-badge")).toBeVisible();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.activeProviderId).toBe("gemini");
  });
});
