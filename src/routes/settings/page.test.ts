import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/svelte";
import type { ProviderConfig } from "$lib/schemas";
import {
  settingsStore,
  upsertProviderConfig,
  removeProviderConfig,
  setActiveProvider,
} from "$lib/stores/settings";
import Page from "./+page.svelte";

function presetConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    providerId: "openai",
    apiKey: "",
    selectedModel: "gpt-5.4-mini",
    ...overrides,
  };
}

beforeEach(() => {
  settingsStore.reset();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Settings page", () => {
  describe("security notice", () => {
    it("renders the security notice with localStorage mention", () => {
      render(Page);
      const notice = screen.getByTestId("security-notice");
      expect(notice).toBeInTheDocument();
      expect(notice.textContent ?? "").toMatch(/localStorage/);
    });

    it("uses a yellow warning palette for the notice", () => {
      render(Page);
      const notice = screen.getByTestId("security-notice");
      expect(notice.className).toContain("yellow");
    });
  });

  describe("title", () => {
    it('renders the page heading "설정"', () => {
      render(Page);
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "설정",
      );
    });
  });

  describe("two-pane layout", () => {
    it("renders the provider-list (left pane) container", () => {
      render(Page);
      expect(screen.getByTestId("provider-list")).toBeInTheDocument();
    });

    it("renders the provider-editor (right pane) container", () => {
      render(Page);
      expect(screen.getByTestId("provider-editor")).toBeInTheDocument();
    });

    it("renders the new-provider-button", () => {
      render(Page);
      expect(screen.getByTestId("new-provider-button")).toBeInTheDocument();
    });
  });

  describe("configured-providers list", () => {
    it("shows the empty state when no providers are configured", () => {
      render(Page);
      expect(screen.getByTestId("provider-list-empty")).toBeInTheDocument();
    });

    it("reflects configured providers from the store", () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-x" }));
      render(Page);
      expect(screen.getAllByTestId("provider-item")).toHaveLength(1);
    });

    it("shows 프리셋 kind label for a configured preset", () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-x" }));
      render(Page);
      expect(screen.getAllByText("프리셋").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 설정됨 when the configured preset has an apiKey", () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-x" }));
      render(Page);
      expect(screen.getAllByText("설정됨").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("selecting a provider", () => {
    it("opens the editor (api-key input) when a provider item is clicked", async () => {
      upsertProviderConfig(presetConfig({ apiKey: "" }));
      render(Page);
      expect(screen.getByTestId("editor-empty")).toBeInTheDocument();

      await fireEvent.click(screen.getByTestId("provider-item"));
      expect(screen.getByTestId("api-key-input")).toBeInTheDocument();
      expect(screen.queryByTestId("editor-empty")).toBeNull();
    });

    it("highlights the selected item", async () => {
      upsertProviderConfig(presetConfig({ apiKey: "" }));
      render(Page);
      await fireEvent.click(screen.getByTestId("provider-item"));
      const item = screen.getByTestId("provider-item");
      expect(item.className).toContain("bg-accent");
    });
  });

  describe("saving a preset API key", () => {
    it("calls upsertProviderConfig and persists to localStorage", async () => {
      upsertProviderConfig(presetConfig({ apiKey: "" }));

      const upsertSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "upsertProviderConfig",
      );

      render(Page);

      await fireEvent.click(screen.getByTestId("provider-item"));
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-saved" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy.mock.calls[0][0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-saved",
      });

      const raw = localStorage.getItem("translator.settings");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.providers[0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-saved",
      });
    });

    it("does NOT call setActiveProvider when a second provider is saved", async () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-first" }));
      setActiveProvider("openai");

      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("custom-option"));
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "Second" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.second.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(setActiveSpy).not.toHaveBeenCalled();
    });
  });

  describe("first-provider-becomes-active", () => {
    it("calls setActiveProvider when the first provider is saved", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("custom-option"));
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "First" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.first.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(setActiveSpy).toHaveBeenCalled();
      });
      const savedId = setActiveSpy.mock.calls[0][0];
      expect(savedId).toMatch(/^custom-/);
    });
  });

  describe("new custom provider flow", () => {
    it("shows the picker when 신규 등록 is clicked", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("new-provider-button"));
      expect(screen.getByTestId("editor-picker")).toBeInTheDocument();
    });

    it("adds a custom provider to the list after saving", async () => {
      render(Page);
      expect(screen.queryAllByTestId("provider-item")).toHaveLength(0);

      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("custom-option"));
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "MyCustom" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.custom.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1, m2" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getAllByTestId("provider-item")).toHaveLength(1);
      });
      expect(screen.getAllByText("MyCustom").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 커스텀 kind label for the new custom provider", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("custom-option"));
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "MyCustom" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.custom.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getAllByText("커스텀").length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("new openai-compat provider flow", () => {
    it("adds a provider via the openai-compat template after entering only baseURL", async () => {
      render(Page);
      expect(screen.queryAllByTestId("provider-item")).toHaveLength(0);

      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.openrouter.ai/v1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getAllByTestId("provider-item")).toHaveLength(1);
      });
      expect(screen.getAllByText("OpenAI 호환").length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it("makes the openai-compat provider the active one when it is the first provider", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      await fireEvent.click(screen.getByTestId("new-provider-button"));
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.openrouter.ai/v1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(setActiveSpy).toHaveBeenCalled();
      });
      expect(setActiveSpy.mock.calls[0][0]).toMatch(/^custom-/);
    });
  });

  describe("delete custom provider", () => {
    it("removes the custom provider from the list after delete + confirm", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "custom-todelete",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.del.com/v1",
        name: "ToDelete",
        models: ["m1"],
        defaultModel: "m1",
      });

      render(Page);
      expect(screen.getAllByTestId("provider-item")).toHaveLength(1);

      await fireEvent.click(screen.getByTestId("provider-item"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      await waitFor(() => {
        expect(screen.queryAllByTestId("provider-item")).toHaveLength(0);
      });
    });

    it("passes the Korean confirm message to window.confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "custom-check",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.c.com/v1",
        name: "Check",
        models: ["m1"],
        defaultModel: "m1",
      });

      render(Page);
      await fireEvent.click(screen.getByTestId("provider-item"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
    });

    it("does NOT delete when confirm returns false", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      upsertProviderConfig({
        providerId: "custom-keep",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.k.com/v1",
        name: "Keep",
        models: ["m1"],
        defaultModel: "m1",
      });

      render(Page);
      await fireEvent.click(screen.getByTestId("provider-item"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("provider-item")).toHaveLength(1);
    });
  });

  describe("set-active", () => {
    it("updates the store via setActiveProvider when set-active clicked", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      upsertProviderConfig(
        presetConfig({ providerId: "openai", apiKey: "sk-a" }),
      );
      upsertProviderConfig(
        presetConfig({
          providerId: "gemini",
          apiKey: "sk-g",
          selectedModel: "gemini-3.5-flash",
        }),
      );
      setActiveProvider("openai");

      render(Page);

      const geminiItem = screen
        .getAllByTestId("provider-item")
        .find(
          (el) => el.getAttribute("data-provider-id") === "gemini",
        ) as HTMLElement;
      await fireEvent.click(
        within(geminiItem).getByTestId("set-active-button"),
      );

      expect(setActiveSpy).toHaveBeenCalledWith("gemini");
    });

    it("shows the active badge on the active provider", () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-a" }));
      setActiveProvider("openai");

      render(Page);
      const openaiItem = screen
        .getAllByTestId("provider-item")
        .find(
          (el) => el.getAttribute("data-provider-id") === "openai",
        ) as HTMLElement;
      expect(
        within(openaiItem).getByTestId("active-badge"),
      ).toBeInTheDocument();
    });
  });

  describe("store integration", () => {
    it("removeProviderConfig drops the provider from the list", () => {
      upsertProviderConfig(presetConfig({ apiKey: "sk-a" }));
      render(Page);
      expect(screen.getAllByTestId("provider-item")).toHaveLength(1);

      removeProviderConfig("openai");
      // After store mutation, the derived list re-renders on next tick.
      waitFor(() => {
        expect(screen.queryAllByTestId("provider-item")).toHaveLength(0);
      });
    });
  });
});
