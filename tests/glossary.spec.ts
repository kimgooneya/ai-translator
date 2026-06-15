import { test, expect } from "@playwright/test";

test.describe("Glossary page", () => {
  test.beforeEach(async ({ page }) => {
    // Isolate localStorage per test
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.glossary");
      } catch {
        // ignore
      }
    });
  });

  test("renders the page heading and empty message", async ({ page }) => {
    await page.goto("/glossary");
    await expect(
      page.getByRole("heading", { level: 1, name: "용어집" }),
    ).toBeVisible();
    await expect(page.getByTestId("glossary-empty-message")).toBeVisible();
    await expect(page.getByTestId("glossary-empty-message")).toContainText(
      "아직 용어가 없습니다",
    );
  });

  test("renders the entry count label as 총 0개 용어 when empty", async ({
    page,
  }) => {
    await page.goto("/glossary");
    await expect(page.getByText("총 0개 용어")).toBeVisible();
  });

  test("adds an entry via the form and shows it in the list", async ({
    page,
  }) => {
    await page.goto("/glossary");
    await expect(page.getByTestId("glossary-entry-row")).toHaveCount(0);

    await page.getByTestId("glossary-source-input").fill("RAG");
    await page.getByTestId("glossary-target-input").fill("검색 증강 생성");
    await page.getByTestId("glossary-submit-button").click();

    await expect(page.getByTestId("glossary-entry-row")).toHaveCount(1);
    await expect(page.getByTestId("entry-source")).toHaveText("RAG");
    await expect(page.getByTestId("entry-target")).toHaveText("검색 증강 생성");
    await expect(page.getByText("총 1개 용어")).toBeVisible();
  });

  test("persists the added entry to localStorage under translator.glossary", async ({
    page,
  }) => {
    await page.goto("/glossary");

    await page.getByTestId("glossary-source-input").fill("Token");
    await page.getByTestId("glossary-target-input").fill("토큰");
    await page.getByTestId("glossary-submit-button").click();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.glossary"),
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0]).toMatchObject({
      source: "Token",
      target: "토큰",
    });
  });

  test("toggles the glossary on and persists enabled=true to localStorage", async ({
    page,
  }) => {
    await page.goto("/glossary");
    const toggle = page.getByTestId("glossary-toggle");
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect(toggle).toBeChecked();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.glossary"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.enabled).toBe(true);
  });

  test("toggles the glossary back off after toggling on", async ({ page }) => {
    await page.goto("/glossary");
    const toggle = page.getByTestId("glossary-toggle");

    await toggle.click();
    await expect(toggle).toBeChecked();

    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });

  test("edits an existing entry and reflects the change", async ({ page }) => {
    await page.goto("/glossary");
    await page.getByTestId("glossary-source-input").fill("LLM");
    await page.getByTestId("glossary-target-input").fill("대규모 언어 모델");
    await page.getByTestId("glossary-submit-button").click();

    await page.getByTestId("edit-button").click();
    const editForm = page.locator(
      '[data-testid="glossary-form"][data-mode="edit"]',
    );
    await editForm.getByTestId("glossary-source-input").fill("LLM2");
    await editForm.getByTestId("glossary-submit-button").click();

    await expect(page.getByTestId("entry-source")).toHaveText("LLM2");
  });

  test("removes an entry after confirming deletion", async ({ page }) => {
    await page.goto("/glossary");
    await page.getByTestId("glossary-source-input").fill("API");
    await page
      .getByTestId("glossary-target-input")
      .fill("응용 프로그래밍 인터페이스");
    await page.getByTestId("glossary-submit-button").click();
    await expect(page.getByTestId("glossary-entry-row")).toHaveCount(1);

    const dialogMessage = new Promise<string>((resolve) => {
      page.on("dialog", async (dialog) => {
        resolve(await dialog.message());
        await dialog.accept();
      });
    });
    await page.getByTestId("delete-button").click();
    expect(await dialogMessage).toContain("삭제");

    await expect(page.getByTestId("glossary-entry-row")).toHaveCount(0);
    await expect(page.getByTestId("glossary-empty-message")).toBeVisible();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.glossary"),
    );
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.entries).toHaveLength(0);
  });
});
