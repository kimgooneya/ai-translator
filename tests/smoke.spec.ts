import { test, expect } from "@playwright/test";

test.describe("Smoke test", () => {
  test("homepage renders the translate UI", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();
    await expect(page.getByTestId("translate-button")).toBeVisible();
  });

  test('document title is "AI 번역기"', async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("AI 번역기");
  });

  test("sidebar renders the new-translation link and app title", async ({
    page,
  }) => {
    await page.goto("/");
    const sidebar = page.getByTestId("app-sidebar");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByTestId("new-translation-link")).toBeVisible();
    await expect(sidebar.getByText("AI 번역기")).toBeVisible();
  });

  test("new translation link is a real link to /", async ({ page }) => {
    await page.goto("/");
    const link = page
      .getByTestId("app-sidebar")
      .getByTestId("new-translation-link");
    await expect(link).toHaveAttribute("href", "/");
  });

  test("settings popover opens and exposes provider/glossary/history actions", async ({
    page,
  }) => {
    await page.goto("/");

    // Popover is closed initially — content absent.
    await expect(page.getByTestId("settings-popover-content")).toHaveCount(0);

    await page.getByTestId("settings-popover-trigger").click();

    const content = page.getByTestId("settings-popover-content");
    await expect(content).toBeVisible();
    await expect(
      content.getByTestId("popover-provider-settings"),
    ).toBeVisible();
    await expect(content.getByTestId("popover-glossary")).toBeVisible();
    await expect(
      content.getByTestId("popover-view-all-history"),
    ).toHaveAttribute("href", "/history");
  });

  test("settings popover opens the provider settings dialog", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("settings-popover-trigger").click();
    await page.getByTestId("popover-provider-settings").click();

    await expect(page.getByTestId("settings-dialog-content")).toBeVisible();
    // SettingsPanel inside the dialog keeps the security notice + provider list.
    await expect(page.getByTestId("security-notice")).toBeVisible();
    await expect(page.getByTestId("provider-list")).toBeVisible();
  });

  test("settings popover opens the glossary dialog", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-popover-trigger").click();
    await page.getByTestId("popover-glossary").click();

    await expect(page.getByTestId("glossary-dialog-content")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "용어집" }),
    ).toBeVisible();
  });

  test("view-all-history link navigates to /history", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-popover-trigger").click();
    await page.getByTestId("popover-view-all-history").click();
    await expect(page).toHaveURL(/\/history$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "번역 기록" }),
    ).toBeVisible();
  });

  test("popover closes on outside click", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("settings-popover-trigger").click();
    await expect(page.getByTestId("settings-popover-content")).toBeVisible();

    // Click the main translate area (outside the popover) to dismiss.
    await page.getByTestId("source-textarea").click();
    await expect(page.getByTestId("settings-popover-content")).toHaveCount(0);
  });
});
