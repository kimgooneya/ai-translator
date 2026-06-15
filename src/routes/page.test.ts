import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { tick } from "svelte";
import type { Writable } from "svelte/store";
import Page from "./+page.svelte";
import { settingsStore } from "$lib/stores/settings";
import { glossaryStore } from "$lib/stores/glossary";
import { historyStore } from "$lib/stores/history";
import type { Settings, TranslationHistoryEntry } from "$lib/schemas";
import { extractTextFromFile, UnsupportedFileTypeError } from "$lib/file/extractText";

const mocks = vi.hoisted(() => {
	class UnsupportedFileTypeError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "UnsupportedFileTypeError";
		}
	}
	return {
		extractTextFromFile: vi.fn(),
		UnsupportedFileTypeError,
	};
});

vi.mock("$lib/file/extractText", () => mocks);

function readStore(
  store: Writable<TranslationHistoryEntry[]>,
): TranslationHistoryEntry[] {
  let value: TranslationHistoryEntry[] = [];
  const unsub = store.subscribe((v) => {
    value = v;
  });
  unsub();
  return value;
}

// bits-ui Select renders a <button> trigger + popover (Portal). Opening the
// popover requires the full pointer sequence (not just click), because
// bits-ui listens for onpointerdown on the trigger. Items render with
// role="option" inside the Portal attached to document.body.
async function openSelectOptions(
  trigger: HTMLElement,
): Promise<HTMLElement[]> {
  await fireEvent.pointerDown(trigger, { button: 0 });
  await fireEvent.pointerUp(trigger, { button: 0 });
  await fireEvent.click(trigger);
  return await screen.findAllByRole("option");
}

const emptySettings: Settings = {
  providers: [],
  activeProviderId: null,
  defaultTargetLang: "ko",
};

const configuredSettings: Settings = {
  providers: [
    {
      providerId: "openai",
      apiKey: "sk-test-key",
      selectedModel: "gpt-5.4-mini",
    },
  ],
  activeProviderId: "openai",
  defaultTargetLang: "ko",
};

describe("Translate page", () => {
  beforeEach(() => {
    localStorage.clear();
    settingsStore.set(emptySettings);
    glossaryStore.set({ enabled: false, entries: [] });
    historyStore.set([]);
    vi.mocked(extractTextFromFile).mockReset();
    vi.mocked(extractTextFromFile).mockImplementation(async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "txt" || file.type === "text/plain") {
        return file.text();
      }
      if (ext === "pdf" || file.type === "application/pdf") {
        return "";
      }
      throw new UnsupportedFileTypeError(`Unsupported: ${file.name}`);
    });
  });

  describe("core elements", () => {
    it("renders the source textarea with Korean placeholder", () => {
      render(Page);
      expect(screen.getByTestId("source-textarea")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("번역할 텍스트를 입력하세요"),
      ).toBeInTheDocument();
    });

    it("renders the result area with placeholder text", () => {
      render(Page);
      expect(screen.getByTestId("result-placeholder")).toHaveTextContent(
        "번역 결과가 여기 표시됩니다",
      );
    });

    it("renders the source language select with 자동 감지 first", async () => {
      render(Page);
      const trigger = screen.getByTestId("source-lang-select");
      // shadcn Select.Trigger renders the selected language name as text
      expect(trigger.textContent).toContain("자동 감지");
      const items = await openSelectOptions(trigger);
      expect(items[0].textContent?.trim()).toBe("자동 감지");
    });

    it("renders the target language select defaulting to ko", () => {
      render(Page);
      const trigger = screen.getByTestId("target-lang-select");
      // shadcn Select.Trigger shows the language name; "ko" → "한국어"
      expect(trigger.textContent).toContain("한국어");
    });

    it("renders the translate button with Korean label", () => {
      render(Page);
      expect(screen.getByTestId("translate-button")).toHaveTextContent(
        "번역하기",
      );
    });
  });

  describe("translate button disabled state", () => {
    it("is disabled when sourceText is empty and no API key", () => {
      render(Page);
      const btn = screen.getByTestId("translate-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("is disabled when sourceText is empty even with API key set", () => {
      settingsStore.set(configuredSettings);
      render(Page);
      const btn = screen.getByTestId("translate-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("is disabled when sourceText present but no API key", async () => {
      render(Page);
      const textarea = screen.getByTestId("source-textarea");
      await fireEvent.input(textarea, { target: { value: "hello" } });
      const btn = screen.getByTestId("translate-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("is enabled when sourceText present and API key configured", async () => {
      settingsStore.set(configuredSettings);
      render(Page);
      const textarea = screen.getByTestId("source-textarea");
      await fireEvent.input(textarea, { target: { value: "hello world" } });
      const btn = screen.getByTestId("translate-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  describe("no API key warning", () => {
    it("shows warning when no active provider", () => {
      render(Page);
      expect(screen.getByTestId("no-api-key-warning")).toBeVisible();
      expect(screen.getByTestId("no-api-key-warning")).toHaveTextContent(
        "활성 provider",
      );
    });

    it("shows warning when provider has empty API key", () => {
      settingsStore.set({
        providers: [
          { providerId: "openai", apiKey: "", selectedModel: "gpt-5.4-mini" },
        ],
        activeProviderId: "openai",
        defaultTargetLang: "ko",
      });
      render(Page);
      expect(screen.getByTestId("no-api-key-warning")).toBeVisible();
    });

    it("includes a link to settings page", () => {
      render(Page);
      const link = screen.getByTestId("no-api-key-warning").querySelector("a");
      expect(link).not.toBeNull();
      expect(link?.getAttribute("href")).toBe("/settings");
    });

    it("hides warning when API key is configured", () => {
      settingsStore.set(configuredSettings);
      render(Page);
      expect(screen.queryByTestId("no-api-key-warning")).toBeNull();
    });
  });

  describe("model select", () => {
    it("shows placeholder when no active provider", () => {
      render(Page);
      const select = screen.getByTestId("model-select") as HTMLSelectElement;
      expect(select.disabled).toBe(true);
      expect(select.value).toBe("");
    });

    it("shows available models when provider is active", async () => {
      settingsStore.set(configuredSettings);
      render(Page);
      await tick();
      const trigger = screen.getByTestId("model-select");
      const items = await openSelectOptions(trigger);
      const labels = items.map((i) => i.textContent?.trim() ?? "");
      expect(labels).toContain("gpt-5.4");
      expect(labels).toContain("gpt-5.4-mini");
      expect(trigger.textContent).toContain("gpt-5.4-mini");
    });
  });

  describe("advanced options", () => {
    it("is collapsed by default (no custom prompt visible)", () => {
      render(Page);
      // Collapsible.Content stays in the DOM with a `hidden` attribute when
      // collapsed, so queryByTestId finds it — assert visibility instead.
      expect(screen.queryByTestId("custom-prompt-input")).not.toBeVisible();
      expect(screen.queryByTestId("glossary-toggle")).not.toBeVisible();
    });

    it("expands to show custom prompt and glossary toggle on click", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("advanced-options-toggle"));
      expect(screen.getByTestId("custom-prompt-input")).toBeVisible();
      expect(screen.getByTestId("glossary-toggle")).toBeVisible();
    });

    it("collapses again on second click", async () => {
      render(Page);
      const toggle = screen.getByTestId("advanced-options-toggle");
      await fireEvent.click(toggle);
      expect(screen.getByTestId("custom-prompt-input")).toBeVisible();
      await fireEvent.click(toggle);
      expect(screen.queryByTestId("custom-prompt-input")).not.toBeVisible();
    });

    it("shows glossary entry count", async () => {
      glossaryStore.set({
        enabled: false,
        entries: [
          { id: "1", source: "RAG", target: "검색 증강 생성" },
          { id: "2", source: "LLM", target: "대규모 언어 모델" },
        ],
      });
      render(Page);
      await fireEvent.click(screen.getByTestId("advanced-options-toggle"));
      expect(screen.getByText(/2개 용어/)).toBeInTheDocument();
    });

    it("glossary toggle reflects store state", async () => {
      glossaryStore.set({ enabled: true, entries: [] });
      render(Page);
      await fireEvent.click(screen.getByTestId("advanced-options-toggle"));
      const toggle = screen.getByTestId("glossary-toggle");
      // shadcn Switch renders a <button role="switch">; checked state is
      // exposed via aria-checked, not an <input>.checked property.
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });

    it("toggling glossary updates the store", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("advanced-options-toggle"));
      const toggle = screen.getByTestId("glossary-toggle");
      expect(toggle).toHaveAttribute("aria-checked", "false");
      await fireEvent.click(toggle);
      await tick();
      expect(toggle).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("char count", () => {
    it("shows 0자 initially", () => {
      render(Page);
      expect(screen.getByText("0자")).toBeInTheDocument();
    });

    it("updates as text is entered", async () => {
      render(Page);
      const textarea = screen.getByTestId("source-textarea");
      await fireEvent.input(textarea, { target: { value: "hello" } });
      expect(screen.getByText("5자")).toBeInTheDocument();
    });
  });

  describe("translate request", () => {
    it("POSTs to /api/translate with correct body on button click", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("data: hello\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      settingsStore.set(configuredSettings);
      render(Page);
      const textarea = screen.getByTestId("source-textarea");
      await fireEvent.input(textarea, { target: { value: "hello world" } });
      await fireEvent.click(screen.getByTestId("translate-button"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/translate");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.sourceText).toBe("hello world");
      expect(body.providerId).toBe("openai");
      expect(body.apiKey).toBe("sk-test-key");
      expect(body.model).toBe("gpt-5.4-mini");
      expect(body.targetLang).toBe("ko");
      expect(body.sourceLang).toBe("auto");

      vi.unstubAllGlobals();
    });

    it("does not call fetch when sourceText is empty", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      settingsStore.set(configuredSettings);
      render(Page);
      // Button is disabled — clicking a disabled button doesn't fire events,
      // but force-click to verify the handler guards against empty text.
      const btn = screen.getByTestId("translate-button") as HTMLButtonElement;
      btn.disabled = false;
      await fireEvent.click(btn);
      expect(mockFetch).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it("surfaces an error toast when the response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              error: "INVALID_API_KEY",
              message: "API 키 오류",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("translate-button")).not.toBeDisabled();
      });

      vi.unstubAllGlobals();
    });
  });

  describe("cancel button", () => {
    it("is not visible when not loading", () => {
      render(Page);
      expect(screen.queryByTestId("cancel-button")).toBeNull();
    });
  });

  describe("streaming render", () => {
    it("renders chunks incrementally into the result area", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("data: 안\n\ndata: 녕\n\ndata: [DONE]\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("result-text")).toHaveTextContent("안녕");
      });
      expect(screen.queryByTestId("result-placeholder")).toBeNull();

      vi.unstubAllGlobals();
    });

    it("keeps the placeholder visible until the first chunk arrives", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("data: [DONE]\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("translate-button")).not.toBeDisabled();
      });
      expect(screen.queryByTestId("result-text")).toBeNull();
      expect(screen.getByTestId("result-placeholder")).toBeInTheDocument();

      vi.unstubAllGlobals();
    });

    it("saves the completed translation to historyStore on done", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response("data: 안녕\n\ndata: [DONE]\n\n", {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        const entries = readStore(historyStore);
        expect(entries).toHaveLength(1);
        expect(entries[0].response).toBe("안녕");
        expect(entries[0].providerName).toBe("OpenAI");
        expect(entries[0].modelName).toBe("gpt-5.4-mini");
      });

      vi.unstubAllGlobals();
    });

    it("surfaces a mid-stream error as a toast while preserving the partial result", async () => {
      const payload = JSON.stringify({
        error: "STREAM_INTERRUPTED",
        message: "중단됨",
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(`data: partial\n\nevent: error\ndata: ${payload}\n\n`, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          }),
        ),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("result-text")).toHaveTextContent("partial");
      });

      vi.unstubAllGlobals();
    });
  });

  describe("cancel during streaming", () => {
    it("aborts the in-flight request when the cancel button is clicked", async () => {
      let capturedSignal: AbortSignal | undefined;
      const slowStream = new ReadableStream<Uint8Array>({
        start(controller) {
          void controller;
        },
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url: string, init: RequestInit) => {
          capturedSignal = init.signal as AbortSignal;
          return Promise.resolve(
            new Response(slowStream, {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            }),
          );
        }),
      );

      settingsStore.set(configuredSettings);
      render(Page);
      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "hello" },
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      await waitFor(() => {
        expect(screen.getByTestId("cancel-button")).toBeVisible();
      });
      await fireEvent.click(screen.getByTestId("cancel-button"));

      expect(capturedSignal?.aborted).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe("file upload", () => {
    it("renders the file upload button", () => {
      render(Page);
      expect(screen.getByTestId("file-upload-label")).toHaveTextContent(
        "파일 불러오기",
      );
    });

    it("shows a file chip with the filename and keeps textarea empty", async () => {
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["hello from file"], "notes.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toHaveTextContent(
          "notes.txt",
        );
      });
      expect(screen.getByTestId("source-textarea")).toHaveValue("");
    });

    it("enables the translate button after loading a file with API key set", async () => {
      settingsStore.set(configuredSettings);
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["hello world"], "doc.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const btn = screen.getByTestId(
          "translate-button",
        ) as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
      });
    });

    it("shows char count of file content, not textarea", async () => {
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["1234567890"], "doc.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("10자")).toBeInTheDocument();
      });
    });

    it("does not load unsupported file types", async () => {
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["data"], "doc.docx", {
        type: "application/octet-stream",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.queryByTestId("loaded-file-chip")).toBeNull();
      });
    });

    it("removes the file chip when the remove button is clicked", async () => {
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["content"], "notes.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByTestId("remove-file-button"));

      expect(screen.queryByTestId("loaded-file-chip")).toBeNull();
    });

    it("clears the file when the user types in the textarea manually", async () => {
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["original content"], "notes.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toBeInTheDocument();
      });

      await fireEvent.input(screen.getByTestId("source-textarea"), {
        target: { value: "manual text" },
      });

      expect(screen.queryByTestId("loaded-file-chip")).toBeNull();
    });

    it("sends file content as sourceText when translating", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("data: [DONE]\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);

      settingsStore.set(configuredSettings);
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File(["file content to translate"], "doc.txt", {
        type: "text/plain",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.sourceText).toBe("file content to translate");

      vi.unstubAllGlobals();
    });

    it("shows a file chip when PDF is uploaded", async () => {
      vi.mocked(extractTextFromFile).mockResolvedValue("pdf extracted text");
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File([new ArrayBuffer(8)], "doc.pdf", {
        type: "application/pdf",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toHaveTextContent(
          "doc.pdf",
        );
      });
      expect(screen.getByTestId("source-textarea")).toHaveValue("");
    });

    it("sends PDF content as sourceText when translating", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("data: [DONE]\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      );
      vi.stubGlobal("fetch", mockFetch);
      vi.mocked(extractTextFromFile).mockResolvedValue(
        "pdf text for translation",
      );

      settingsStore.set(configuredSettings);
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File([new ArrayBuffer(8)], "doc.pdf", {
        type: "application/pdf",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId("loaded-file-chip")).toBeInTheDocument();
      });
      await fireEvent.click(screen.getByTestId("translate-button"));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.sourceText).toBe("pdf text for translation");

      vi.unstubAllGlobals();
    });

    it("does not load PDF with no extractable text", async () => {
      vi.mocked(extractTextFromFile).mockResolvedValue("");
      render(Page);
      const input = screen.getByTestId(
        "file-upload-input",
      ) as HTMLInputElement;
      const file = new File([new ArrayBuffer(8)], "scanned.pdf", {
        type: "application/pdf",
      });
      await fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.queryByTestId("loaded-file-chip")).toBeNull();
      });
    });
  });
});
