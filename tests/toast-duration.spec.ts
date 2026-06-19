import { test, expect, type Page } from "@playwright/test";

// Verifies that error toasts stay visible for ~10 seconds, matching the
// `toast.error(msg, { duration: 10000 })` contract wired up in the translate
// page (translateAction onError + invalid file type). Default (non-error)
// Sonner toasts auto-close at 4s, so this is a deliberate override for errors
// that users need time to read.

// Managed-key: settings carry no apiKey.
function seedSettings(): void {
  localStorage.setItem(
    "translator.settings",
    JSON.stringify({
      providers: [{ providerId: "openai", selectedModel: "gpt-5.4-mini" }],
      activeProviderId: "openai",
      defaultTargetLang: "ko",
    }),
  );
}

async function mockCatalog(page: Page): Promise<void> {
  await page.route("**/api/user/providers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        providers: [
          {
            id: "openai",
            name: "OpenAI",
            kind: "preset",
            baseURL: "https://api.openai.com/v1",
            models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
            defaultModel: "gpt-5.4-mini",
          },
        ],
      }),
    });
  });
}

function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe("Error toast duration (10s)", () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = capturePageErrors(page);
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

  test.afterEach(() => {
    if (pageErrors.length > 0) {
      throw new Error(
        `Unhandled page errors during test:\n${pageErrors.join("\n")}`,
      );
    }
  });

  test("error toast stays visible for ~10 seconds", async ({ page }) => {
    await mockCatalog(page);
    await page.addInitScript(seedSettings);
    await page.route("**/api/translate", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_API_KEY",
          message: "ignored-server-text",
        }),
      });
    });

    await page.goto("/");
    await page.getByTestId("source-textarea").fill("hello");
    await page.getByTestId("translate-button").click();

    const errorToast = page.locator(
      '[data-sonner-toast][data-type="error"]',
    );
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // The behavior under test IS the wall-clock duration. There is no DOM
    // state change to wait for between "toast appeared" and "10s elapsed",
    // so an explicit `waitForTimeout` is the correct primitive (not abuse).
    // 4s would dismiss a default Sonner toast; 8s is comfortably past the
    // default but still inside the 10s error-duration window.
    await page.waitForTimeout(8000);
    await expect(errorToast).toBeVisible();

    // Wait past the 10s duration + Sonner's 200ms exit-animation grace
    // (TIME_BEFORE_UNMOUNT in Toast.svelte). At ~11s total the toast must
    // be gone.
    await page.waitForTimeout(3500);
    await expect(errorToast).toHaveCount(0);
  });

  test("default-duration warning toast auto-dismisses well before 10s", async ({
    page,
    context,
  }) => {
    // Inverse check: the 10s duration is reserved for *errors*. Warning and
    // info toasts use the Sonner default (4s). This guards against a future
    // regression that accidentally bumps every toast to 10s.
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();

    await context.setOffline(true);
    const warningToast = page.locator(
      '[data-sonner-toast][data-type="warning"]',
    );
    await expect(warningToast).toBeVisible({ timeout: 5000 });

    // After ~6s the warning toast must already be gone (4s duration + ~200ms
    // unmount grace + generous buffer).
    await page.waitForTimeout(6000);
    await expect(warningToast).toHaveCount(0);
  });
});
