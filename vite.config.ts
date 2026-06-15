import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }: { filename: string }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter({ runtime: "nodejs20.x" }),
    }),
  ],
  // bits-ui ships .svelte sources; must be bundled for SSR (Vercel).
  ssr: { noExternal: ["bits-ui"] },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    setupFiles: ["./tests/setup.ts"],
    environment: "jsdom",
    globals: true,
  },
  resolve: process.env.VITEST
    ? {
        conditions: ["browser"],
      }
    : undefined,
});
