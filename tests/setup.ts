import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/svelte";

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
