import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    ignores: [
      "build/",
      ".svelte-kit/",
      "node_modules/",
      ".omo/",
      ".opencode/",
      ".vercel/",
      "**/*.js", // Ignore auto-generated JS files
      "**/*.d.ts", // Ignore auto-generated type declarations
    ],
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: [".svelte"],
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        DOMException: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        confirm: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        SubmitEvent: "readonly",
        hasApiKey: "writable",
      },
    },
    plugins: {
      svelte,
    },
    rules: {
      ...svelte.configs.base.rules,
    },
  },
  {
    files: ["**/*.test.ts", "tests/**/*.ts", "tests/**/*.spec.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        console: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
  },
];
