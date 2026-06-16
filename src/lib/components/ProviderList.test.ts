import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import ProviderList from "./ProviderList.svelte";
import type { Provider, ProviderConfig } from "$lib/schemas";

function makePreset(
  id: string,
  name: string,
  overrides: Partial<Provider> = {},
): Provider {
  return {
    id,
    name,
    kind: "preset",
    baseURL: `https://api.${id}.com/v1`,
    models: ["model-a", "model-b"],
    defaultModel: "model-a",
    ...overrides,
  };
}

function makeCustom(
  id: string,
  name: string,
  overrides: Partial<Provider> = {},
): Provider {
  return {
    id,
    name,
    kind: "custom",
    baseURL: `https://api.${id}.com/v1`,
    models: ["custom-m"],
    defaultModel: "custom-m",
    ...overrides,
  };
}

function makeConfig(
  providerId: string,
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    providerId,
    apiKey: "",
    selectedModel: "model-a",
    ...overrides,
  };
}

describe("ProviderList", () => {
  describe("rendering", () => {
    it("renders the provider-list container", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getByTestId("provider-list")).toBeInTheDocument();
    });

    it("renders an item for each provider", () => {
      const providers = [
        makePreset("openai", "OpenAI"),
        makePreset("gemini", "Google Gemini"),
        makeCustom("mycustom", "MyCustom"),
      ];
      render(ProviderList, {
        providers,
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByTestId("provider-item")).toHaveLength(3);
    });

    it("sets data-provider-id on each item", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      const item = screen.getAllByTestId("provider-item")[0];
      expect(item.getAttribute("data-provider-id")).toBe("openai");
    });

    it("shows the provider name in each item", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByText("OpenAI").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("empty state", () => {
    it("renders provider-list-empty when no providers", () => {
      render(ProviderList, {
        providers: [],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getByTestId("provider-list-empty")).toBeInTheDocument();
    });

    it("does not render any provider-item when empty", () => {
      render(ProviderList, {
        providers: [],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.queryAllByTestId("provider-item")).toHaveLength(0);
    });
  });

  describe("kind badge", () => {
    it("shows 프리셋 for preset providers", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByText("프리셋").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 커스텀 for custom providers", () => {
      render(ProviderList, {
        providers: [makeCustom("mycustom", "MyCustom")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByText("커스텀").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("API key status", () => {
    it("shows 미설정 when no config exists", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByText("미설정").length).toBeGreaterThanOrEqual(1);
    });

    it("shows 설정됨 when config has an apiKey", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [makeConfig("openai", { apiKey: "sk-xxx" })],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getAllByText("설정됨").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("selected highlight", () => {
    it("applies a selection affordance to the selected item", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: "openai",
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      const item = screen.getByTestId("provider-item");
      expect(item.className).toContain("bg-accent");
    });
  });

  describe("active provider", () => {
    it("shows 활성 badge on the active provider item", () => {
      render(ProviderList, {
        providers: [
          makePreset("openai", "OpenAI"),
          makePreset("gemini", "Gemini"),
        ],
        configs: [],
        activeProviderId: "openai",
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      const openaiItem = screen
        .getAllByTestId("provider-item")
        .find(
          (el) => el.getAttribute("data-provider-id") === "openai",
        ) as HTMLElement;
      expect(
        within(openaiItem).getByTestId("active-badge"),
      ).toBeInTheDocument();
      expect(within(openaiItem).getByText("활성")).toBeInTheDocument();
    });

    it("shows set-active button on non-active items", () => {
      render(ProviderList, {
        providers: [
          makePreset("openai", "OpenAI"),
          makePreset("gemini", "Gemini"),
        ],
        configs: [],
        activeProviderId: "openai",
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      const geminiItem = screen
        .getAllByTestId("provider-item")
        .find(
          (el) => el.getAttribute("data-provider-id") === "gemini",
        ) as HTMLElement;
      expect(
        within(geminiItem).getByTestId("set-active-button"),
      ).toBeInTheDocument();
    });

    it("does NOT show set-active button on the active item", () => {
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: "openai",
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.queryByTestId("set-active-button")).toBeNull();
    });

    it("calls onSetActive with providerId when set-active clicked", async () => {
      const onSetActive = vi.fn();
      render(ProviderList, {
        providers: [
          makePreset("openai", "OpenAI"),
          makePreset("gemini", "Gemini"),
        ],
        configs: [],
        activeProviderId: "openai",
        selectedId: null,
        onselect: () => {},
        onSetActive,
        onnew: () => {},
      });
      await fireEvent.click(screen.getAllByTestId("set-active-button")[0]);
      expect(onSetActive).toHaveBeenCalledWith("gemini");
    });
  });

  describe("item selection", () => {
    it("calls onselect with providerId when item body is clicked", async () => {
      const onselect = vi.fn();
      render(ProviderList, {
        providers: [makePreset("openai", "OpenAI")],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect,
        onSetActive: () => {},
        onnew: () => {},
      });
      await fireEvent.click(screen.getByTestId("provider-item"));
      expect(onselect).toHaveBeenCalledWith("openai");
    });

    it("does NOT call onselect when the set-active button is clicked", async () => {
      const onselect = vi.fn();
      const onSetActive = vi.fn();
      render(ProviderList, {
        providers: [
          makePreset("openai", "OpenAI"),
          makePreset("gemini", "Gemini"),
        ],
        configs: [],
        activeProviderId: "openai",
        selectedId: null,
        onselect,
        onSetActive,
        onnew: () => {},
      });
      await fireEvent.click(screen.getAllByTestId("set-active-button")[0]);
      expect(onselect).not.toHaveBeenCalled();
      expect(onSetActive).toHaveBeenCalledWith("gemini");
    });
  });

  describe("new provider button", () => {
    it("renders the new-provider-button", () => {
      render(ProviderList, {
        providers: [],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew: () => {},
      });
      expect(screen.getByTestId("new-provider-button")).toBeInTheDocument();
    });

    it("calls onnew when clicked", async () => {
      const onnew = vi.fn();
      render(ProviderList, {
        providers: [],
        configs: [],
        activeProviderId: null,
        selectedId: null,
        onselect: () => {},
        onSetActive: () => {},
        onnew,
      });
      await fireEvent.click(screen.getByTestId("new-provider-button"));
      expect(onnew).toHaveBeenCalledTimes(1);
    });
  });
});
