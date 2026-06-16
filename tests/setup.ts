import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/svelte";
import { initI18n } from "$lib/i18n";

// Tests assert against the default Korean locale; override per-test via `locale.set`.
initI18n();

// Cleanup after each test to avoid memory leaks
afterEach(() => {
  cleanup();
});

// localStorage polyfill — jsdom provides it but ensure it's reset between tests
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

// Mock matchMedia (used by some Svelte patterns)
if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom does not implement ResizeObserver, but bits-ui's ScrollArea (used by
// HistoryList) instantiates one in a $effect. Polyfill with a no-op stub so
// rendering components that contain ScrollArea doesn't throw. Real browsers
// are unaffected.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom does not implement the Pointer Capture API, but bits-ui's Select.Trigger
// calls `target.hasPointerCapture(...)` in its onpointerdown handler. Polyfill
// globally so any test that interacts with a shadcn Select works without
// per-file setup.
if (
  typeof HTMLElement !== "undefined" &&
  typeof HTMLElement.prototype.hasPointerCapture !== "function"
) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.setPointerCapture = () => {};
}

// jsdom lacks the Web Animations API used by Svelte 5 `transition:*` directives.
// Returning an immediately-resolving fake lets outro transitions complete in
// tests without throwing (real browsers are unaffected).
interface AnimationLike {
  cancel: () => void;
  finish: () => void;
  play: () => void;
  pause: () => void;
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  finished: Promise<AnimationLike>;
  currentTime: number;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
}

if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.animate !== "function"
) {
  const createFakeAnimation = (): AnimationLike => {
    let anim: AnimationLike | null = null;
    anim = {
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      onfinish: null,
      oncancel: null,
      currentTime: 0,
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
      finished: Promise.resolve(null as unknown as AnimationLike),
    };
    anim.finished = Promise.resolve(anim);
    Promise.resolve().then(() => {
      anim?.onfinish?.();
    });
    return anim;
  };

  Element.prototype.animate =
    createFakeAnimation as unknown as typeof Element.prototype.animate;
}
