import { test, expect, type Page } from "@playwright/test";

// History is Supabase-backed (translation_history table, RLS-scoped). The
// historyStore is populated by a PostgREST GET on mount when a user is signed
// in, so these specs mock /rest/v1/translation_history to seed data
// deterministically. (Delete/clear issue matching DELETEs.)
//
// Managed-key note: the stored request payload carries NO apiKey — the server
// resolves keys per request. These specs never seed one.
// Like the other e2e files, reaching /history needs a logged-in user (auth gate).

const HISTORY_ENDPOINT = "**/rest/v1/translation_history*";

interface MinimalEntry {
  id: string;
  request: {
    sourceText: string;
    sourceLang: string;
    targetLang: string;
    providerId: string;
    model: string;
    customPrompt?: string;
  };
  response: string;
  providerName: string;
  modelName: string;
  createdAt: string;
  tokensUsed?: number;
}

/** Snake-case DB row shape that loadHistory maps back into MinimalEntry. */
interface HistoryRow {
  id: string;
  user_id: string;
  request: MinimalEntry["request"];
  response: string;
  provider_name: string;
  model_name: string;
  created_at: string;
  tokens_used: number | null;
}

function toRow(e: MinimalEntry, userId = "u-1"): HistoryRow {
  return {
    id: e.id,
    user_id: userId,
    request: e.request,
    response: e.response,
    provider_name: e.providerName,
    model_name: e.modelName,
    created_at: e.createdAt,
    tokens_used: e.tokensUsed ?? null,
  };
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

/**
 * Intercept every Supabase PostgREST call on translation_history and back it
 * with an in-memory array. GET returns the current rows newest-first (mirrors
 * `.order("created_at", { ascending: false })`); DELETE removes rows matching
 * the `id=eq.X` / `user_id=eq.X` filter supabase-js emits.
 */
async function mockHistory(
  page: Page,
  seed: MinimalEntry[],
): Promise<void> {
  const rows: HistoryRow[] = seed.map((e) => toRow(e));

  await page.route(HISTORY_ENDPOINT, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET") {
      const sorted = [...rows].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sorted),
      });
      return;
    }

    if (request.method() === "DELETE") {
      const idFilter = url.searchParams.get("id");
      const userFilter = url.searchParams.get("user_id");
      if (idFilter) {
        const id = idFilter.replace(/^eq\./, "");
        const idx = rows.findIndex((r) => r.id === id);
        if (idx >= 0) rows.splice(idx, 1);
      } else if (userFilter) {
        const uid = userFilter.replace(/^eq\./, "");
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].user_id === uid) rows.splice(i, 1);
        }
      }
      await route.fulfill({ status: 200, body: "" });
      return;
    }

    await route.fulfill({ status: 200, body: "" });
  });
}

test.describe("History page", () => {
  test("renders the page heading and empty message when there is no history", async ({
    page,
  }) => {
    await mockHistory(page, []);
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
    await mockHistory(page, []);
    await page.goto("/history");
    await expect(page.getByTestId("history-clear-all-button")).toBeDisabled();
  });

  test("renders the 100-entry limit notice", async ({ page }) => {
    await mockHistory(page, []);
    await page.goto("/history");
    await expect(page.getByTestId("history-limit-notice")).toContainText(
      "100개를 초과하면",
    );
    await expect(page.getByTestId("history-limit-notice")).toContainText(
      "자동 삭제",
    );
  });

  test("renders seeded entries newest-first", async ({ page }) => {
    await mockHistory(page, makeEntries(3));
    await page.goto("/history");

    await expect(page.getByTestId("history-entry-card")).toHaveCount(3);
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
    await mockHistory(page, [
      {
        id: "rich-1",
        request: {
          sourceText: "hello world",
          sourceLang: "en",
          targetLang: "ja",
          providerId: "deepseek",
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
    await mockHistory(page, [
      {
        id: "long-1",
        request: {
          sourceText: longSource,
          sourceLang: "auto",
          targetLang: "ko",
          providerId: "openai",
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

  test("opens the detail panel with full content when 자세히 is clicked", async ({
    page,
  }) => {
    const longSource = "x".repeat(80);
    const longResponse = "y".repeat(80);
    await mockHistory(page, [
      {
        id: "detail-1",
        request: {
          sourceText: longSource,
          sourceLang: "auto",
          targetLang: "ko",
          providerId: "openai",
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

  test("closes the detail panel when the close button is clicked", async ({
    page,
  }) => {
    await mockHistory(page, makeEntries(1));
    await page.goto("/history");

    await page.getByTestId("history-detail-button").click();
    await expect(page.getByTestId("history-detail-modal")).toBeVisible();

    await page.getByTestId("history-detail-close").click();
    await expect(page.getByTestId("history-detail-modal")).toHaveCount(0);
  });

  test("deletes a single entry when the card 삭제 button is clicked", async ({
    page,
  }) => {
    await mockHistory(page, makeEntries(2));
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
  });

  test("clears all entries after confirming the 전체 삭제 dialog", async ({
    page,
  }) => {
    await mockHistory(page, makeEntries(3));
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
  });

  test("does NOT clear all entries when the 전체 삭제 dialog is dismissed", async ({
    page,
  }) => {
    await mockHistory(page, makeEntries(2));
    await page.goto("/history");

    page.on("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByTestId("history-clear-all-button").click();

    await expect(page.getByTestId("history-entry-card")).toHaveCount(2);
  });

  test("renders up to 100 entries without issues", async ({ page }) => {
    await mockHistory(page, makeEntries(100));
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
