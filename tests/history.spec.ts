import { test, expect } from "@playwright/test";

const HISTORY_KEY = "translator.history";

interface MinimalEntry {
  id: string;
  request: {
    sourceText: string;
    sourceLang: string;
    targetLang: string;
    providerId: string;
    apiKey: string;
    model: string;
    customPrompt?: string;
  };
  response: string;
  providerName: string;
  modelName: string;
  createdAt: string;
}

function makeEntries(n: number, prefix = "seed"): MinimalEntry[] {
  const out: MinimalEntry[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push({
      id: `${prefix}-${i}`,
      request: {
        sourceText: `source text ${i}`,
        sourceLang: "auto",
        targetLang: "ko",
        providerId: "openai",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      },
      response: `번역 결과 ${i}`,
      providerName: "OpenAI",
      modelName: "gpt-4o-mini",
      createdAt: new Date(2025, 0, 1, 0, 0, i).toISOString(),
    });
  }
  return out;
}

async function seedHistory(
  page: import("@playwright/test").Page,
  entries: MinimalEntry[],
): Promise<void> {
  await page.addInitScript(
    (args) => {
      try {
        localStorage.setItem(args.key, JSON.stringify(args.value));
      } catch {
        // ignore
      }
    },
    { key: HISTORY_KEY, value: entries },
  );
}

test.describe("History page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.history");
      } catch {
        // ignore
      }
    });
  });

  test("renders the page heading and empty message when there is no history", async ({
    page,
  }) => {
    await page.goto("/history");
    await expect(
      page.getByRole("heading", { level: 1, name: "번역 기록" }),
    ).toBeVisible();
    await expect(page.getByTestId("history-empty-message")).toBeVisible();
    await expect(page.getByTestId("history-empty-message")).toContainText(
      "번역 기록이 없습니다",
    );
  });

  test("disables the clear-all button when empty", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByTestId("history-clear-all-button")).toBeDisabled();
  });

  test("renders the 100-entry limit notice", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByTestId("history-limit-notice")).toContainText(
      "100개를 초과하면",
    );
    await expect(page.getByTestId("history-limit-notice")).toContainText(
      "자동 삭제",
    );
  });

  test("renders seeded entries from localStorage newest-first", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(3));
    await page.goto("/history");

    await expect(page.getByTestId("history-entry-card")).toHaveCount(3);
    // Newest first → seed-2, seed-1, seed-0
    const ids = await page
      .getByTestId("history-entry-card")
      .evaluateAll((cards) =>
        cards.map((c) => c.getAttribute("data-entry-id")),
      );
    expect(ids).toEqual(["seed-2", "seed-1", "seed-0"]);
  });

  test("shows provider, model, language pair, and previews on each card", async ({
    page,
  }) => {
    await seedHistory(page, [
      {
        id: "rich-1",
        request: {
          sourceText: "hello world",
          sourceLang: "en",
          targetLang: "ja",
          providerId: "deepseek",
          apiKey: "sk-test",
          model: "deepseek-chat",
        },
        response: "こんにちは世界",
        providerName: "DeepSeek",
        modelName: "deepseek-chat",
        createdAt: new Date("2025-06-14T09:30:00.000Z").toISOString(),
      },
    ]);
    await page.goto("/history");

    await expect(page.getByTestId("history-provider")).toHaveText("DeepSeek");
    await expect(page.getByTestId("history-model")).toHaveText("deepseek-chat");
    await expect(page.getByTestId("history-source-lang")).toHaveText("en");
    await expect(page.getByTestId("history-target-lang")).toHaveText("ja");
    await expect(page.getByTestId("history-source-preview")).toHaveText(
      "hello world",
    );
    await expect(page.getByTestId("history-response-preview")).toHaveText(
      "こんにちは世界",
    );
  });

  test("truncates previews longer than 50 characters", async ({ page }) => {
    const longSource = "a".repeat(80);
    const longResponse = "b".repeat(80);
    await seedHistory(page, [
      {
        id: "long-1",
        request: {
          sourceText: longSource,
          sourceLang: "auto",
          targetLang: "ko",
          providerId: "openai",
          apiKey: "sk-test",
          model: "gpt-4o-mini",
        },
        response: longResponse,
        providerName: "OpenAI",
        modelName: "gpt-4o-mini",
        createdAt: new Date("2025-06-14T09:30:00.000Z").toISOString(),
      },
    ]);
    await page.goto("/history");

    const sourcePreview = await page
      .getByTestId("history-source-preview")
      .textContent();
    expect(sourcePreview?.endsWith("...")).toBe(true);
    expect(sourcePreview?.length).toBe(53);
    const responsePreview = await page
      .getByTestId("history-response-preview")
      .textContent();
    expect(responsePreview?.endsWith("...")).toBe(true);
  });

  test("opens the detail modal with full content when 자세히 is clicked", async ({
    page,
  }) => {
    const longSource = "x".repeat(80);
    const longResponse = "y".repeat(80);
    await seedHistory(page, [
      {
        id: "detail-1",
        request: {
          sourceText: longSource,
          sourceLang: "auto",
          targetLang: "ko",
          providerId: "openai",
          apiKey: "sk-test",
          model: "gpt-4o-mini",
          customPrompt: "비즈니스 격식체",
        },
        response: longResponse,
        providerName: "OpenAI",
        modelName: "gpt-4o-mini",
        createdAt: new Date("2025-06-14T09:30:00.000Z").toISOString(),
      },
    ]);
    await page.goto("/history");

    await expect(page.getByTestId("history-detail-modal")).toHaveCount(0);
    await page.getByTestId("history-detail-button").click();
    await expect(page.getByTestId("history-detail-modal")).toBeVisible();

    // Full untruncated content
    await expect(page.getByTestId("history-detail-source")).toContainText(
      longSource,
    );
    await expect(page.getByTestId("history-detail-response")).toContainText(
      longResponse,
    );
    await expect(page.getByTestId("history-detail-custom-prompt")).toHaveText(
      "비즈니스 격식체",
    );
  });

  test("closes the detail modal when the close button is clicked", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(1));
    await page.goto("/history");

    await page.getByTestId("history-detail-button").click();
    await expect(page.getByTestId("history-detail-modal")).toBeVisible();

    await page.getByTestId("history-detail-close").click();
    await expect(page.getByTestId("history-detail-modal")).toHaveCount(0);
  });

  test("closes the detail modal when the backdrop is clicked", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(1));
    await page.goto("/history");

    await page.getByTestId("history-detail-button").click();
    await expect(page.getByTestId("history-detail-modal")).toBeVisible();

    await page
      .getByTestId("history-detail-backdrop")
      .click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId("history-detail-modal")).toHaveCount(0);
  });

  test("deletes a single entry when the card 삭제 button is clicked", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(2));
    await page.goto("/history");
    await expect(page.getByTestId("history-entry-card")).toHaveCount(2);

    const firstCard = page
      .locator('[data-testid="history-entry-card"]')
      .first();
    await firstCard.getByTestId("history-delete-button").click();

    await expect(page.getByTestId("history-entry-card")).toHaveCount(1);
    const remainingId = await page
      .getByTestId("history-entry-card")
      .getAttribute("data-entry-id");
    expect(remainingId).toBe("seed-0");

    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      HISTORY_KEY,
    );
    const parsed = JSON.parse(raw ?? "[]");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("seed-0");
  });

  test("clears all entries after confirming the 전체 삭제 dialog", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(3));
    await page.goto("/history");
    await expect(page.getByTestId("history-entry-card")).toHaveCount(3);

    const dialogMessage = new Promise<string>((resolve) => {
      page.on("dialog", async (dialog) => {
        resolve(await dialog.message());
        await dialog.accept();
      });
    });
    await page.getByTestId("history-clear-all-button").click();
    expect(await dialogMessage).toContain("모든 기록을 삭제하시겠습니까?");

    await expect(page.getByTestId("history-entry-card")).toHaveCount(0);
    await expect(page.getByTestId("history-empty-message")).toBeVisible();

    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      HISTORY_KEY,
    );
    expect(JSON.parse(raw ?? "[]")).toEqual([]);
  });

  test("does NOT clear all entries when the 전체 삭제 dialog is dismissed", async ({
    page,
  }) => {
    await seedHistory(page, makeEntries(2));
    await page.goto("/history");

    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByTestId("history-clear-all-button").click();

    await expect(page.getByTestId("history-entry-card")).toHaveCount(2);
    const raw = await page.evaluate(
      (key) => localStorage.getItem(key),
      HISTORY_KEY,
    );
    expect(JSON.parse(raw ?? "[]")).toHaveLength(2);
  });

  test("renders up to 100 entries without issues", async ({ page }) => {
    await seedHistory(page, makeEntries(100));
    await page.goto("/history");

    await expect(page.getByTestId("history-entry-card")).toHaveCount(100);
    const ids = await page
      .getByTestId("history-entry-card")
      .evaluateAll((cards) =>
        cards.map((c) => c.getAttribute("data-entry-id")),
      );
    expect(ids[0]).toBe("seed-99");
    expect(ids[99]).toBe("seed-0");
  });
});
