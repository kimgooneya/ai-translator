import { test, expect } from "@playwright/test";

// Verifies there is no Flash Of Unstyled Content (FOUC) when a user with a
// previously-saved dark preference reloads the page. The anti-FOUC contract
// is implemented in `src/app.html`: an inline script in `<head>` reads
// `localStorage.getItem('mode-watcher-mode')` and adds the `dark` class to
// `documentElement` *before* SvelteKit hydrates — so the very first paint
// already matches the persisted theme.

test.describe("No FOUC on initial load (pre-hydration dark class)", () => {
  test("no FOUC on initial load with persisted dark mode", async ({
    browser,
  }) => {
    // Use a fresh context so we control exactly what's in localStorage at
    // navigation time. `addInitScript` runs on every document navigation
    // including the initial one, before any page script executes — so the
    // stored value is in place when app.html's inline script runs.
    const context = await browser.newContext();
    await context.addInitScript(() => {
      try {
        localStorage.setItem("mode-watcher-mode", "dark");
      } catch {
        // ignore
      }
    });

    const page = await context.newPage();

    // Capture any errors that fire during load so a Sonner/mode-watcher
    // exception doesn't masquerade as a "pass".
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    // `waitUntil: "domcontentloaded"` is the earliest point at which the
    // inline head script has run AND the documentElement exists in the DOM
    // tree. The dark class must already be present here — if it's only
    // applied post-hydration, the user would see a light-theme flash.
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const htmlClass = await page.evaluate(
      () => document.documentElement.className,
    );
    expect(htmlClass).toContain("dark");

    // Re-check after hydration completes (load event) to ensure the class
    // stays applied — mode-watcher should not remove it once it boots.
    await page.waitForLoadState("load");
    const htmlClassAfterHydration = await page.evaluate(
      () => document.documentElement.className,
    );
    expect(htmlClassAfterHydration).toContain("dark");

    if (errors.length > 0) {
      throw new Error(
        `Unhandled page errors during load:\n${errors.join("\n")}`,
      );
    }

    await context.close();
  });

  test("no FOUC on initial load with system dark preference (no localStorage)", async ({
    browser,
  }) => {
    // Fresh context with prefers-color-scheme: dark and NO localStorage entry.
    // The app.html fallback (`!theme && matchMedia('(prefers-color-scheme: dark)')`)
    // must still apply the dark class pre-hydration.
    const context = await browser.newContext({
      colorScheme: "dark",
    });
    // Make sure localStorage is empty for this context.
    await context.addInitScript(() => {
      try {
        localStorage.removeItem("mode-watcher-mode");
      } catch {
        // ignore
      }
    });

    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const htmlClass = await page.evaluate(
      () => document.documentElement.className,
    );
    expect(htmlClass).toContain("dark");

    await context.close();
  });
});
