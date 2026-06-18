/**
 * Transient (non-persisted) UI state shared across components.
 *
 * Matches the plain `writable` convention used by other stores in this
 * directory (see `locale.ts`); no `$state` runes, so this is a `.ts` file.
 *
 * `settingsOpen` is the single source of truth for the settings modal's
 * visibility. It's triggered from multiple sibling components under the layout:
 *   - the sidebar "Provider settings" menu item (SettingsPopover)
 *   - the "no API key" warning link on the translate page (+page.svelte)
 *
 * Use the `openSettings()` / `closeSettings()` helpers rather than `.set()`
 * directly for readability.
 */

import { writable } from "svelte/store";

export const settingsOpen = writable<boolean>(false);

export function openSettings(): void {
  settingsOpen.set(true);
}

export function closeSettings(): void {
  settingsOpen.set(false);
}
