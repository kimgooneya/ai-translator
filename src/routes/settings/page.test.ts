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
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "설정",
      );
    });
  });

  describe("preset providers", () => {
    it("renders all 5 preset providers by name", () => {
      render(Page);
      const expected = [
        "OpenAI",
        "Google Gemini",
        "Qwen (DashScope)",
        "Zhipu Z.AI",
        "DeepSeek",
      ];
      for (const name of expected) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });

    it("renders exactly 5 provider cards when no customs configured", () => {
      render(Page);
      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
    });

    it("does not render a delete button for any preset card", () => {
      render(Page);
      expect(screen.queryAllByTestId("delete-button")).toHaveLength(0);
    });

    it("shows 미설정 on preset cards that have no stored config", () => {
      render(Page);
      expect(screen.getAllByText("미설정")).toHaveLength(5);
    });
  });

  describe("API key persistence (save flow)", () => {
    it("renders a password input for every provider card", () => {
      render(Page);
      const inputs = screen
        .getAllByTestId("api-key-input")
        .map((el) => el as HTMLInputElement);
      expect(inputs).toHaveLength(5);
      for (const input of inputs) {
        expect(input.type).toBe("password");
      }
    });

    it("calls upsertProviderConfig + setActiveProvider when saving the first provider", async () => {
      const upsertSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "upsertProviderConfig",
      );
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);

      const firstInput = screen.getAllByTestId("api-key-input")[0];
      await fireEvent.input(firstInput, { target: { value: "sk-first" } });
      await fireEvent.click(screen.getAllByTestId("save-button")[0]);

      expect(upsertSpy).toHaveBeenCalledTimes(1);
      expect(upsertSpy.mock.calls[0][0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-first",
      });
      expect(setActiveSpy).toHaveBeenCalledWith("openai");
    });

    it("does NOT call setActiveProvider when a second provider is saved", async () => {
      // Seed one provider first
      upsertProviderConfig(presetConfig());
      setActiveProvider("openai");

      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );

      render(Page);
      // Save the second preset (gemini)
      const cards = screen.getAllByTestId("provider-card");
      const geminiCard = cards.find(
        (c) => c.getAttribute("data-provider-id") === "gemini",
      ) as HTMLElement;
      const geminiInput = within(geminiCard).getByTestId("api-key-input");
      await fireEvent.input(geminiInput, { target: { value: "sk-gemini" } });
      await fireEvent.click(within(geminiCard).getByTestId("save-button"));

      expect(setActiveSpy).not.toHaveBeenCalled();
    });

    it("reflects 설정됨 indicator after a preset is saved (store round-trip)", async () => {
      render(Page);
      expect(screen.getAllByText("미설정")).toHaveLength(5);

      const firstInput = screen.getAllByTestId("api-key-input")[0];
      await fireEvent.input(firstInput, { target: { value: "sk-saved" } });
      await fireEvent.click(screen.getAllByTestId("save-button")[0]);

      expect(screen.getAllByText("설정됨")).toHaveLength(1);
      expect(screen.getAllByText("미설정")).toHaveLength(4);
    });
  });

  describe("custom provider add flow", () => {
    it("renders the add-provider form at the bottom", () => {
      render(Page);
      expect(screen.getByTestId("add-provider-form")).toBeInTheDocument();
      expect(screen.getByText("새 provider 추가")).toBeInTheDocument();
    });

    it("adds a custom provider card when the form is submitted with valid data", async () => {
      render(Page);
      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);

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

      expect(screen.getAllByTestId("provider-card")).toHaveLength(6);
      expect(screen.getByText("MyCustom")).toBeInTheDocument();
    });

    it("shows Korean error and does NOT add a card when name is empty", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.custom.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.getByTestId("error-name")).toHaveTextContent(
        "이름을 입력하세요.",
      );
    });

    it("shows Korean error when baseURL is empty", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.getByTestId("error-base-url")).toHaveTextContent(
        "Base URL을 입력하세요.",
      );
    });

    it("shows Korean error when baseURL is not a valid URL", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "not-a-url" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.getByTestId("error-base-url")).toHaveTextContent(/URL/);
    });

    it("shows Korean error when models is empty", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.x.com/v1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.getByTestId("error-models")).toHaveTextContent(
        "최소 한 개의 모델을 입력하세요.",
      );
    });

    it("resets the form after a successful add", async () => {
      render(Page);
      await fireEvent.input(screen.getByTestId("add-name-input"), {
        target: { value: "Reset" },
      });
      await fireEvent.input(screen.getByTestId("add-base-url-input"), {
        target: { value: "https://api.r.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("add-models-input"), {
        target: { value: "m1" },
      });
      await fireEvent.click(screen.getByTestId("add-submit-button"));

      expect(
        (screen.getByTestId("add-name-input") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByTestId("add-base-url-input") as HTMLInputElement).value,
      ).toBe("");
      expect(
        (screen.getByTestId("add-models-input") as HTMLInputElement).value,
      ).toBe("");
    });

    it("sets the new custom provider as active when it is the first provider", async () => {
      const setActiveSpy = vi.spyOn(
        await import("$lib/stores/settings"),
        "setActiveProvider",
      );
      render(Page);

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

  describe("custom provider delete flow", () => {
    it("renders a delete button on custom provider cards", () => {
      // Seed a custom provider directly via store
      upsertProviderConfig({
        providerId: "ToDelete",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.x.com/v1",
      });

      render(Page);
      const deleteButtons = screen.getAllByTestId("delete-button");
      expect(deleteButtons).toHaveLength(1);
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
      expect(screen.getAllByTestId("provider-card")).toHaveLength(6);

      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(6);
    });

    it("removes the custom card when confirm() returns true", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "Gone",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.g.com/v1",
      });

      render(Page);
      expect(screen.getAllByTestId("provider-card")).toHaveLength(6);

      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.queryByText("Gone")).toBeNull();
    });

    it("passes the Korean confirm message to window.confirm", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      upsertProviderConfig({
        providerId: "Check",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.c.com/v1",
      });

      render(Page);
      await fireEvent.click(screen.getByTestId("delete-button"));

      expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
    });
  });

  describe("store integration", () => {
    it("persists saved providers to localStorage", async () => {
      render(Page);
      const firstInput = screen.getAllByTestId("api-key-input")[0];
      await fireEvent.input(firstInput, { target: { value: "sk-persist" } });
      await fireEvent.click(screen.getAllByTestId("save-button")[0]);

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
      expect(screen.getAllByTestId("provider-card")).toHaveLength(5);
      expect(screen.queryByText("Drop")).toBeNull();
    });
  });
});
