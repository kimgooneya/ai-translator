import { test, expect, type Page } from "@playwright/test";

// Verifies the dark-mode toggle button flips the html.dark class, persists
// the choice to localStorage (key: `mode-watcher-mode`), and survives a
// full page reload. The reload leg depends on app.html's inline pre-hydration
// script (reads the same key + adds the dark class before SvelteKit boots).

function capturePageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

test.describe("Dark mode toggle (mode-watcher)", () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = capturePageErrors(page);
  });

  test.afterEach(() => {
    if (pageErrors.length > 0) {
      throw new Error(
        `Unhandled page errors during test:\n${pageErrors.join("\n")}`,
      );
    }
  });

  test("dark mode toggle persists across reload", async ({ page }) => {
    // Playwright's `devices["Desktop Chrome"]` defaults `colorScheme` to
    // "light", so the initial state is light unless the user opts in.
    await page.goto("/");
    const html = page.locator("html");

    // Sanity: starting from light (no .dark class on <html>).
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 5000 });

    // The theme toggle lives inside the sidebar's settings popover, so open
    // it first. mode-watcher's `toggleMode` writes `mode-watcher-mode=dark`
    // to localStorage and toggles the .dark class on documentElement.
    await page.getByTestId("settings-popover-trigger").click();
    await page.getByTestId("theme-toggle").click();

    // Use a polling assertion (NOT a fixed waitForTimeout) so the test
    // advances as soon as ModeWatcher applies the change. ModeWatcher's
    // effect runs after hydration + one microtask, typically <100ms.
    await expect(html).toHaveClass(/\bdark\b/, { timeout: 3000 });

    // Persistence contract: mode-watcher writes the resolved mode to
    // localStorage so the inline pre-hydration script in app.html can
    // restore it on the next load (see no-fouc.spec.ts for the FOUC
    // equivalent).
    const stored = await page.evaluate(() =>
      localStorage.getItem("mode-watcher-mode"),
    );
    expect(stored).toBe("dark");

    // Full reload: app.html's inline script reads `mode-watcher-mode` and
    // adds the dark class BEFORE SvelteKit hydrates. The post-reload <html>
    // must therefore already carry `.dark` (no flash of light theme).
    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/, { timeout: 3000 });

    // And the persisted mode survives the round-trip.
    const storedAfterReload = await page.evaluate(() =>
      localStorage.getItem("mode-watcher-mode"),
    );
    expect(storedAfterReload).toBe("dark");
  });

  test("toggling twice returns to light mode and persists light", async ({
    page,
  }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 5000 });

    // Theme toggle is inside the settings popover — open it first.
    await page.getByTestId("settings-popover-trigger").click();
    const toggle = page.getByTestId("theme-toggle");

    // dark → light
    await toggle.click();
    await expect(html).toHaveClass(/\bdark\b/, { timeout: 3000 });
    await toggle.click();
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 3000 });

    const stored = await page.evaluate(() =>
      localStorage.getItem("mode-watcher-mode"),
    );
    expect(stored).toBe("light");

    // Reload must NOT have the dark class.
    await page.reload();
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 3000 });
  });
});
