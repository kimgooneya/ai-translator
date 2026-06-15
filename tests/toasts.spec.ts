import { test, expect } from "@playwright/test";

// The settings literal must live inside seedSettings(): addInitScript only
// serializes the function body, so module-scope consts are undefined in-page.
function seedSettings(): void {
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
}

test.describe("Toast notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.settings");
        localStorage.removeItem("translator.glossary");
        localStorage.removeItem("translator.history");
      } catch {
        // ignore
      }
    });
  });

  test("shows a red error toast with a Korean message on a 401 from /api/translate", async ({
    page,
  }) => {
    await page.addInitScript(seedSettings);
    await page.route("**/api/translate", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_API_KEY",
          message: "server-text",
        }),
      });
    });

    await page.goto("/");
    await page.getByTestId("source-textarea").fill("hello");
    await page.getByTestId("translate-button").click();

    const toast = page.getByTestId("toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("data-toast-type", "error");
    await expect(page.getByTestId("toast-message")).toContainText(
      "API 키를 확인하세요",
    );
  });

  test("clicking the close button removes the toast immediately", async ({
    page,
  }) => {
    await page.addInitScript(seedSettings);
    await page.route("**/api/translate", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "PROVIDER_ERROR", message: "boom" }),
      });
    });

    await page.goto("/");
    await page.getByTestId("source-textarea").fill("hello");
    await page.getByTestId("translate-button").click();

    await expect(page.getByTestId("toast")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("toast-close").click();
    await expect(page.getByTestId("toast")).toHaveCount(0);
  });

  test("shows a warning toast when the browser goes offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByTestId("toast")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("toast")).toHaveAttribute(
      "data-toast-type",
      "warning",
    );
    await expect(page.getByTestId("toast-message")).toHaveText(
      "네트워크 연결이 끊어졌습니다.",
    );
  });

  test("shows an info toast when connectivity is restored", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByTestId("toast-message").first()).toHaveText(
      "네트워크 연결이 끊어졌습니다.",
    );

    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("toast-message").last()).toContainText(
      "복구",
      { timeout: 5000 },
    );
    await expect(page.getByTestId("toast").last()).toHaveAttribute(
      "data-toast-type",
      "info",
    );
  });
});
