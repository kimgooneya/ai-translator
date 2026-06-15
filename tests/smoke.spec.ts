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

  test("navigation renders all 4 Korean labels", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(
      nav.getByRole("link", { name: "번역", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "설정", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "용어집", exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "기록", exact: true }),
    ).toBeVisible();
  });

  test("app title appears in nav", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav.getByText("AI 번역기")).toBeVisible();
  });
});
