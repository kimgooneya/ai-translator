// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Project runs vitest with `globals: true`; type the global vi/describe/it/etc.
// (additive ambient reference; does not alter compilerOptions.types).
/// <reference types="vitest/globals" />

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
