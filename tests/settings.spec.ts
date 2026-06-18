import { test, expect, type Page } from "@playwright/test";

async function openSettingsModal(page: Page): Promise<void> {
  await page.goto("/");
  // Sidebar lives in the layout, present on every page.
  await page.getByTestId("settings-popover-trigger").click();
  // Popover content renders conditionally; click the provider-settings menu item.
  await page.getByTestId("popover-provider-settings").click();
  // Wait for the bits-ui Dialog to be visible before interacting with its contents.
  await page.getByRole("dialog").waitFor({ state: "visible" });
}

test.describe("Settings modal", () => {
  test.beforeEach(async ({ page }) => {
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
    await openSettingsModal(page);
    const notice = page.getByTestId("security-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("localStorage");
  });

  test("shows the empty list state when no providers are configured", async ({
    page,
  }) => {
    await openSettingsModal(page);
    await expect(page.getByTestId("provider-list")).toBeVisible();
    await expect(page.getByTestId("provider-list-empty")).toBeVisible();
    await expect(page.getByTestId("editor-empty")).toBeVisible();
  });

  test("configures a preset via the new-provider flow and persists to localStorage", async ({
    page,
  }) => {
    await openSettingsModal(page);
    await expect(page.getByTestId("provider-item")).toHaveCount(0);

    // Open the picker and choose the preset option.
    await page.getByTestId("new-provider-button").click();
    await expect(page.getByTestId("editor-picker")).toBeVisible();
    await page.getByTestId("preset-option").click();

    // Pick OpenAI from the preset-select (bits-ui Select).
    await page.getByTestId("preset-select").click();
    await page.getByRole("option", { name: "OpenAI" }).click();

    // Enter an API key and save.
    await page.getByTestId("api-key-input").fill("sk-e2e-preset-key");
    await page.getByTestId("save-button").click();

    // The provider now appears in the list and is the active provider.
    await expect(
      page.locator('[data-testid="provider-item"][data-provider-id="openai"]'),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-testid="provider-item"][data-provider-id="openai"]')
        .getByTestId("active-badge"),
    ).toBeVisible();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: "openai",
          apiKey: "sk-e2e-preset-key",
        }),
      ]),
    );
    expect(parsed.activeProviderId).toBe("openai");
  });

  test("adds a custom provider via the new custom flow and sees it in the list", async ({
    page,
  }) => {
    await openSettingsModal(page);
    await expect(page.getByTestId("provider-item")).toHaveCount(0);

    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("custom-option").click();

    await page.getByTestId("name-input").fill("MyProvider");
    await page.getByTestId("base-url-input").fill("https://api.test.com/v1");
    await page.getByTestId("models-input").fill("m1, m2");
    await page.getByTestId("save-button").click();

    await expect(page.getByTestId("provider-item")).toHaveCount(1);
    await expect(page.getByText("MyProvider", { exact: true })).toBeVisible();
    await expect(page.getByText("커스텀").first()).toBeVisible();
  });

  test("adds a provider via the openai-compat template with pre-filled models", async ({
    page,
  }) => {
    await openSettingsModal(page);
    await expect(page.getByTestId("provider-item")).toHaveCount(0);

    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("openai-compat-option").click();

    await expect(page.getByTestId("name-input")).toHaveValue("OpenAI 호환");
    await expect(page.getByTestId("models-input")).toHaveValue(
      "gpt-5.4, gpt-5.4-mini",
    );

    await page.getByTestId("base-url-input").fill("https://api.openrouter.ai/v1");
    await page.getByTestId("save-button").click();

    await expect(page.getByTestId("provider-item")).toHaveCount(1);
    await expect(page.getByText("OpenAI 호환", { exact: true })).toBeVisible();
    await expect(page.getByText("커스텀").first()).toBeVisible();
  });

  test("shows a Korean error when the custom form has an empty name", async ({
    page,
  }) => {
    await openSettingsModal(page);

    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("custom-option").click();
    await page.getByTestId("base-url-input").fill("https://api.test.com/v1");
    await page.getByTestId("models-input").fill("m1");

    await expect(page.getByTestId("error-name")).toHaveText(
      "이름을 입력하세요.",
    );
  });

  test("edits and saves a custom provider API key, then deletes it with confirm", async ({
    page,
  }) => {
    await openSettingsModal(page);

    // Add a custom provider first.
    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("custom-option").click();
    await page.getByTestId("name-input").fill("Deletable");
    await page.getByTestId("base-url-input").fill("https://api.del.com/v1");
    await page.getByTestId("models-input").fill("m1");
    await page.getByTestId("save-button").click();

    await expect(page.getByTestId("provider-item")).toHaveCount(1);

    // Open it in the editor and set an API key.
    await page.locator('[data-testid="provider-item"]').first().click();
    await page.getByTestId("api-key-input").fill("sk-custom-key");
    await page.getByTestId("save-button").click();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          apiKey: "sk-custom-key",
          name: "Deletable",
        }),
      ]),
    );

    // Re-open and delete via confirm dialog.
    await page.locator('[data-testid="provider-item"]').first().click();
    await expect(page.getByTestId("delete-button")).toBeVisible();

    const dialogMessage = new Promise<string>((resolve) => {
      page.on("dialog", async (dialog) => {
        resolve(await dialog.message());
        await dialog.accept();
      });
    });
    await page.getByTestId("delete-button").click();
    expect(await dialogMessage).toContain("삭제");

    await expect(page.getByTestId("provider-item")).toHaveCount(0);
    await expect(page.getByText("Deletable", { exact: true })).toHaveCount(0);
  });

  test("sets the active provider via the list button", async ({ page }) => {
    await openSettingsModal(page);

    // Configure OpenAI (becomes active as the first provider).
    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("preset-option").click();
    await page.getByTestId("preset-select").click();
    await page.getByRole("option", { name: "OpenAI" }).click();
    await page.getByTestId("api-key-input").fill("sk-openai");
    await page.getByTestId("save-button").click();

    // Add a custom provider (not active).
    await page.getByTestId("new-provider-button").click();
    await page.getByTestId("custom-option").click();
    await page.getByTestId("name-input").fill("Custom");
    await page.getByTestId("base-url-input").fill("https://api.custom.com/v1");
    await page.getByTestId("models-input").fill("m1");
    await page.getByTestId("save-button").click();

    await expect(page.getByTestId("provider-item")).toHaveCount(2);

    // Click set-active on the custom provider row.
    const customRow = page
      .locator('[data-testid="provider-item"]')
      .filter({ hasText: "Custom" });
    await customRow.getByTestId("set-active-button").click();

    await expect(customRow.getByTestId("active-badge")).toBeVisible();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.activeProviderId).toMatch(/^custom-/);
  });
});
