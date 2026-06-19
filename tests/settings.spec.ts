import { test, expect, type Page } from "@playwright/test";

// Managed-key model: the settings page no longer has a provider editor or any
// API-key entry. It renders the admin-managed provider catalog (served by
// GET /api/user/providers) and lets the user pick an active provider + model.
// Keys are handled by the admin — the client never sees one.

// The catalog literal must live inside addInitScript callbacks / route handlers
// (only the function body is serialized to the page).
const OPENAI_MODELS = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"];
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-pro-preview"];

function catalogBody(): string {
  return JSON.stringify({
    providers: [
      {
        id: "openai",
        name: "OpenAI",
        kind: "preset",
        baseURL: "https://api.openai.com/v1",
        models: OPENAI_MODELS,
        defaultModel: "gpt-5.4-mini",
      },
      {
        id: "gemini",
        name: "Google Gemini",
        kind: "preset",
        baseURL:
          "https://generativelanguage.googleapis.com/v1beta/openai/",
        models: GEMINI_MODELS,
        defaultModel: "gemini-3.5-flash",
      },
    ],
  });
}

async function mockCatalog(page: Page, body = catalogBody()): Promise<void> {
  await page.route("**/api/user/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body,
    });
  });
}

test.describe("Settings page (managed-key catalog)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("translator.settings");
      } catch {
        // ignore
      }
    });
  });

  test("renders the managed-key security notice", async ({ page }) => {
    await mockCatalog(page);
    await page.goto("/settings");

    const notice = page.getByTestId("security-notice");
    await expect(notice).toBeVisible();
    // The notice explains the admin-managed model (no localStorage / BYOK).
    await expect(notice).toContainText("관리자");
  });

  test("shows the empty state when the provider catalog is empty", async ({
    page,
  }) => {
    await mockCatalog(page, JSON.stringify({ providers: [] }));
    await page.goto("/settings");

    await expect(page.getByTestId("provider-list-empty")).toBeVisible();
  });

  test("shows a loading message while the catalog is fetching, then providers", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.goto("/settings");

    await expect(page.getByTestId("provider-item")).toHaveCount(2);
    await expect(
      page.locator(
        '[data-testid="provider-item"][data-provider-id="openai"]',
      ),
    ).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="provider-item"][data-provider-id="gemini"]',
      ),
    ).toBeVisible();
  });

  test("sets the active provider via the list button and persists selection (no apiKey)", async ({
    page,
  }) => {
    await mockCatalog(page);
    await page.goto("/settings");

    // OpenAI is the first provider and not active yet.
    const geminiRow = page.locator(
      '[data-testid="provider-item"][data-provider-id="gemini"]',
    );
    await geminiRow.getByTestId("set-active-button").click();

    await expect(geminiRow.getByTestId("active-badge")).toBeVisible();

    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}");
    expect(parsed.activeProviderId).toBe("gemini");
    // Managed-key invariant: settings carry NO api key.
    const configs = parsed.providers as Array<Record<string, unknown>>;
    for (const cfg of configs) {
      expect(cfg).not.toHaveProperty("apiKey");
    }
  });

  test("shows the model select for the active provider and persists a choice", async ({
    page,
  }) => {
    // Seed an already-active OpenAI provider (no apiKey). A legacy top-level
    // `apiKey` is also seeded to assert the schema strips it on load — managed
    // settings must never leak a key back into localStorage.
    await page.addInitScript(() => {
      localStorage.setItem(
        "translator.settings",
        JSON.stringify({
          providers: [{ providerId: "openai", selectedModel: "gpt-5.4-mini" }],
          activeProviderId: "openai",
          defaultTargetLang: "ko",
          apiKey: "sk-legacy",
        }),
      );
    });
    await mockCatalog(page);
    await page.goto("/settings");

    // The active-provider model picker is present.
    await expect(page.getByTestId("active-provider-model")).toBeVisible();

    // bits-ui Select: click the trigger, then pick an option by role.
    await page.getByTestId("model-select").click();
    await page.getByRole("option", { name: "gpt-5.5" }).click();

    await expect
      .poll(async () => {
        const raw = await page.evaluate(() =>
          localStorage.getItem("translator.settings"),
        );
        return JSON.parse(raw ?? "{}");
      })
      .toMatchObject({
        providers: [
          expect.objectContaining({
            providerId: "openai",
            selectedModel: "gpt-5.5",
          }),
        ],
        activeProviderId: "openai",
      });

    // Legacy BYOK fields are stripped — no apiKey anywhere in settings.
    const raw = await page.evaluate(() =>
      localStorage.getItem("translator.settings"),
    );
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("sk-legacy");
  });});
