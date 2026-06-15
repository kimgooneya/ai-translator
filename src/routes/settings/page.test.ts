import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
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
    apiKey: "sk-preset",
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
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("설정");
    });
  });

  describe("provider table", () => {
    it("renders the provider table container", () => {
      render(Page);
      expect(screen.getByTestId("provider-table")).toBeInTheDocument();
    });

    it("renders all 5 preset providers by name", () => {
      render(Page);
      const expected = ["OpenAI", "Google Gemini", "Qwen (DashScope)", "Zhipu Z.AI", "DeepSeek"];
      for (const name of expected) {
        expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
      }
    });

    it("renders 5 provider rows (desktop) when no customs configured", () => {
      render(Page);
      expect(screen.getAllByTestId("provider-row")).toHaveLength(5);
    });

    it("shows 미설정 on all presets when no config stored", () => {
      render(Page);
      expect(screen.getAllByText("미설정").length).toBeGreaterThanOrEqual(5);
    });

    it("shows 프리셋 kind label for preset providers", () => {
      render(Page);
      expect(screen.getAllByText("프리셋").length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("edit drawer", () => {
    it("opens the drawer when edit button is clicked", async () => {
      render(Page);
      const editButtons = screen.getAllByTestId("edit-button");
      await fireEvent.click(editButtons[0]);
      expect(screen.getByTestId("edit-provider-drawer")).toBeInTheDocument();
    });

    it("renders apiKey input with type=password in drawer (behavior preservation)", async () => {
      render(Page);
      await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
      const input = screen.getByTestId("api-key-input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("does NOT show baseURL input for preset providers in drawer", async () => {
      render(Page);
      await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
      expect(screen.queryByTestId("base-url-input")).toBeNull();
    });

    it("calls upsertProviderConfig + setActiveProvider when saving the first provider (wasEmpty)", async () => {
      const upsertSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "upsertProviderConfig",
      );
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-first" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy.mock.calls[0][0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-first",
      });
      expect(setActiveSpy).toHaveBeenCalledWith("openai");
    });

    it("does NOT call setActiveProvider when a second provider is saved", async () => {
      upsertProviderConfig(presetConfig());
      setActiveProvider("openai");

      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      const editButtons = screen.getAllByTestId("edit-button");
      const geminiButton = editButtons.find((btn) => {
        const row = btn.closest("tr");
        return row?.getAttribute("data-provider-id") === "gemini";
      }) as HTMLElement;

      await fireEvent.click(geminiButton);
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-gemini" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(setActiveSpy).not.toHaveBeenCalled();
    });

    it("reflects 설정됨 indicator after a preset is saved", async () => {
      render(Page);
      expect(screen.getAllByText("미설정").length).toBeGreaterThanOrEqual(5);

      await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-saved" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(screen.getAllByText("설정됨").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("add provider modal", () => {
    it("renders the add-provider trigger button", () => {
      render(Page);
      expect(screen.getByTestId("add-provider-button")).toBeInTheDocument();
    });

    it("opens the modal when trigger is clicked", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("add-provider-button"));
      expect(screen.getByTestId("add-provider-modal")).toBeInTheDocument();
    });

    it("adds a custom provider row when submitted with valid data", async () => {
      render(Page);
      expect(screen.getAllByTestId("provider-row")).toHaveLength(5);

      await fireEvent.click(screen.getByTestId("add-provider-button"));
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "MyCustom" },
      });
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.custom.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1, m2" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(screen.getAllByTestId("provider-row")).toHaveLength(6);
    });

    it("shows Korean error when name is empty", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("add-provider-button"));
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.x.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));
      expect(screen.getByTestId("error-name")).toHaveTextContent("이름을 입력하세요.");
    });

    it("shows Korean error when baseURL is empty", async () => {
      render(Page);
      await fireEvent.click(screen.getByTestId("add-provider-button"));
      await fireEvent.input(screen.getByTestId("add-name-input"), { target: { value: "X" } });
      await fireEvent.input(screen.getByTestId("add-models-input"), { target: { value: "m1" } });
      await fireEvent.click(screen.getByTestId("add-submit-button"));
      expect(screen.getByTestId("error-base-url")).toHaveTextContent("Base URL을 입력하세요.");
    });

    it("sets new custom provider as active when it is the first (wasEmpty)", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );
      render(Page);

      await fireEvent.click(screen.getByTestId("add-provider-button"));
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "First" },
      });
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.f.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(setActiveSpy).toHaveBeenCalledWith("First");
    });
  });

  describe("custom provider edit/delete flow", () => {
    it("shows delete button in drawer for custom providers", async () => {
      upsertProviderConfig({
        providerId: "ToDelete",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.x.com/v1",
      });

      render(Page);

      const customRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "ToDelete") as HTMLElement;
      await fireEvent.click(within(customRow).getByTestId("edit-button"));

      expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    });

    it("does NOT delete when confirm() returns false", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      upsertProviderConfig({
        providerId: "Keep",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.k.com/v1",
      });

      render(Page);
      expect(screen.getAllByTestId("provider-row")).toHaveLength(6);

      const customRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "Keep") as HTMLElement;
      await fireEvent.click(within(customRow).getByTestId("edit-button"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("provider-row")).toHaveLength(6);
    });

    it("removes the custom row when confirm() returns true", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "Gone",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.g.com/v1",
      });

      render(Page);
      expect(screen.getAllByTestId("provider-row")).toHaveLength(6);

      const customRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "Gone") as HTMLElement;
      await fireEvent.click(within(customRow).getByTestId("edit-button"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("provider-row")).toHaveLength(5);
    });

    it("passes the Korean confirm message to window.confirm (behavior preservation)", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "Check",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.c.com/v1",
      });

      render(Page);

      const customRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "Check") as HTMLElement;
      await fireEvent.click(within(customRow).getByTestId("edit-button"));
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
    });
  });

  describe("active provider management", () => {
    it("shows 활성 badge on the active provider", () => {
      upsertProviderConfig(presetConfig());
      setActiveProvider("openai");

      render(Page);
      const openaiRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "openai") as HTMLElement;
      expect(within(openaiRow).getByText("활성")).toBeInTheDocument();
    });

    it("calls setActiveProvider when set-active button clicked", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );
      upsertProviderConfig(presetConfig());
      setActiveProvider("openai");

      render(Page);

      const geminiRow = screen
        .getAllByTestId("provider-row")
        .find((r) => r.getAttribute("data-provider-id") === "gemini") as HTMLElement;
      await fireEvent.click(within(geminiRow).getByTestId("set-active-button"));

      expect(setActiveSpy).toHaveBeenCalledWith("gemini");
    });
  });

  describe("store integration", () => {
    it("persists saved providers to localStorage", async () => {
      render(Page);

      await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-persist" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      const raw = localStorage.getItem("translator.settings");
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw ?? "{}");
      expect(parsed.providers).toHaveLength(1);
      expect(parsed.providers[0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-persist",
      });
    });

    it("removeProviderConfig drops the provider from the store", () => {
      upsertProviderConfig({
        providerId: "Drop",
        apiKey: "sk",
        selectedModel: "m1",
        baseURL: "https://api.d.com/v1",
      });
      removeProviderConfig("Drop");

      render(Page);
      expect(screen.getAllByTestId("provider-row")).toHaveLength(5);
    });
  });
});
