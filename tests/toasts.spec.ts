import { test, expect, type Page } from "@playwright/test";

// Managed-key: settings carry no apiKey. Translate-dependent tests mock
// GET /api/user/providers so the page has an active provider.
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

// Surface unhandled page errors as test failures instead of letting them
// silently degrade the E2E signal. Each toast test wires this in beforeEach
// so aSonner runtime exception or uncaught rejection fails loudly.
function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe("Toast notifications (svelte-sonner)", () => {
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
    // Fail loudly if any unhandled error leaked during the test. We do this
    // in afterEach (rather than throwing inside the pageerror handler) so
    // the test's own assertion failures surface first and don't get masked.
    if (pageErrors.length > 0) {
      throw new Error(
        `Unhandled page errors during test:\n${pageErrors.join("\n")}`,
      );
    }
  });

  test("shows an error toast with a Korean message on a 401 from /api/translate", async ({
    page,
  }) => {
    await mockCatalog(page);
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

    // Sonner renders `<li data-sonner-toast data-type="error">…</li>` and
    // `toast.error(msg)` puts the message into the title slot (the inner
    // `[data-title]` div). We assert on the typed toast root + text content
    // instead of legacy testid hooks that Sonner does not emit.
    const errorToast = page.locator(
      '[data-sonner-toast][data-type="error"]',
    );
    await expect(errorToast).toBeVisible({ timeout: 5000 });
    await expect(errorToast).toContainText("API 키를 확인하세요");
  });

  test("swiping the toast dismisses it immediately (sonner default dismiss gesture)", async ({
    page,
  }) => {
    // Sonner's `<Toaster>` does not render a close button unless
    // `closeButton` is opted in (the project does not). The default
    // user-facing dismissal mechanism is therefore a swipe gesture past the
    // 45px threshold. This test replaces the legacy "click close button"
    // assertion with the equivalent Sonner UX: a downward swipe removes the
    // toast before its auto-close timer fires.

    // Override the default 720-tall viewport so the bottom-positioned toast
    // is fully on-screen — otherwise its center lands below the viewport and
    // the browser dispatches no pointer events to it (elementFromPoint →
    // null), which makes the swipe silently no-op.
    await page.setViewportSize({ width: 1280, height: 1000 });

    await mockCatalog(page);
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

    const toast = page.locator('[data-sonner-toast]').first();
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Default Toaster position is `bottom-right`; the auto-derived swipe
    // directions are therefore `bottom` and `right`. A downward drag (positive
    // yDelta, matches `bottom`) past the SWIPE_THRESHOLD (45px) triggers
    // `deleteToast()` → the toast unmounts after a 200ms exit animation.
    const box = await toast.boundingBox();
    expect(box).not.toBeNull();
    const startX = box!.x + box!.width / 2;
    // Aim at the toast's visible top region: with default Sonner bottom
    // positioning the toast's center can land below the viewport, which
    // means elementFromPoint (used by the browser to dispatch mouse events)
    // would return null and no pointer events would reach the toast.
    // Starting ~15px inside the top edge keeps the pointer on the toast AND
    // inside the viewport.
    const startY = box!.y + 15;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag 80px (well past the 45px threshold). Even though some of the
    // intermediate positions land below the viewport, the initial
    // pointerdown captured the pointer to the toast element, so subsequent
    // pointermove events are still routed to it.
    await page.mouse.move(startX, startY + 80, { steps: 12 });
    await page.mouse.up();

    await expect(toast).toHaveCount(0, { timeout: 2000 });
  });

  test("shows a warning toast when the browser goes offline", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();

    await context.setOffline(true);

    // Default (non-error) Sonner duration is 4s, so assert promptly.
    const warningToast = page.locator(
      '[data-sonner-toast][data-type="warning"]',
    );
    await expect(warningToast).toBeVisible({ timeout: 5000 });
    await expect(warningToast).toContainText(
      "네트워크 연결이 끊어졌습니다.",
    );
  });

  test("shows an info toast when connectivity is restored", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("source-textarea")).toBeVisible();

    // Drive the offline/online lifecycle via window event dispatch (matches
    // the layout's listeners; deterministic regardless of Chromium's
    // navigator.onLine signaling).
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(
      page.locator('[data-sonner-toast][data-type="warning"]'),
    ).toContainText("네트워크 연결이 끊어졌습니다.", { timeout: 5000 });

    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    // Sonner unshifts new toasts, so the info toast is newest (DOM-first).
    // Filter by data-type to stay order-independent.
    await expect(
      page.locator('[data-sonner-toast][data-type="info"]'),
    ).toContainText("복구", { timeout: 5000 });
  });
});
