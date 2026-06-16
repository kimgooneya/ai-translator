import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import ProviderEditor from "./ProviderEditor.svelte";
import type { Provider, ProviderConfig } from "$lib/schemas";

function makePresetProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "openai",
    name: "OpenAI",
    kind: "preset",
    baseURL: "https://api.openai.com/v1",
    models: ["gpt-5.4", "gpt-5.4-mini"],
    defaultModel: "gpt-5.4-mini",
    ...overrides,
  };
}

function makeCustomProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: "mycustom",
    name: "MyCustom",
    kind: "custom",
    baseURL: "https://api.custom.com/v1",
    models: ["m1", "m2"],
    defaultModel: "m1",
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    providerId: "openai",
    apiKey: "",
    selectedModel: "gpt-5.4-mini",
    ...overrides,
  };
}

describe("ProviderEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("empty state", () => {
    it("shows editor-empty when mode is edit but no provider selected", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.getByTestId("editor-empty")).toBeInTheDocument();
    });

    it("shows the empty-state title and description text", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.getByTestId("editor-empty").textContent ?? "").toContain(
        "Provider를 선택",
      );
    });
  });

  describe("edit preset", () => {
    it("renders the api-key input with type=password", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig(),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      const input = screen.getByTestId("api-key-input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders the model select trigger", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig(),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.getByTestId("model-select")).toBeInTheDocument();
    });

    it("does NOT render baseURL/name/models inputs for presets", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig(),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.queryByTestId("base-url-input")).toBeNull();
      expect(screen.queryByTestId("name-input")).toBeNull();
      expect(screen.queryByTestId("models-input")).toBeNull();
    });

    it("does NOT render the delete button for presets", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig(),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.queryByTestId("delete-button")).toBeNull();
    });

    it("disables save when nothing changed (not dirty)", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig({ apiKey: "sk-existing" }),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it("enables save after apiKey change", async () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig({ apiKey: "sk-existing" }),
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-new" },
      });
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it("trims apiKey on save and omits baseURL", async () => {
      const onsave = vi.fn();
      render(ProviderEditor, {
        mode: "edit",
        provider: makePresetProvider(),
        config: makeConfig({ apiKey: "" }),
        unconfiguredPresets: [],
        onsave,
        oncancel: () => {},
      });
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "  sk-trimmed  " },
      });
      await fireEvent.click(screen.getByTestId("save-button"));
      expect(onsave).toHaveBeenCalledTimes(1);
      expect(onsave.mock.calls[0][0]).toMatchObject({
        providerId: "openai",
        apiKey: "sk-trimmed",
        selectedModel: "gpt-5.4-mini",
      });
      expect(onsave.mock.calls[0][0].baseURL).toBeUndefined();
      expect(onsave.mock.calls[0][1]).toBe(false);
    });
  });

  describe("edit custom", () => {
    const customProvider = makeCustomProvider();
    const customConfig = makeConfig({
      providerId: "mycustom",
      apiKey: "",
      selectedModel: "m1",
      baseURL: "https://api.custom.com/v1",
      name: "MyCustom",
      models: ["m1", "m2"],
      defaultModel: "m1",
    });

    it("renders all definition fields (name/baseURL/models/defaultModel/apiKey)", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: customConfig,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
        ondelete: () => {},
      });
      expect(screen.getByTestId("name-input")).toBeInTheDocument();
      expect(screen.getByTestId("base-url-input")).toBeInTheDocument();
      expect(screen.getByTestId("models-input")).toBeInTheDocument();
      expect(screen.getByTestId("default-model-select")).toBeInTheDocument();
      expect(screen.getByTestId("api-key-input")).toBeInTheDocument();
    });

    it("renders the delete button when ondelete is provided", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: customConfig,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
        ondelete: () => {},
      });
      expect(screen.getByTestId("delete-button")).toBeInTheDocument();
    });

    it("does NOT render the delete button when ondelete is undefined", () => {
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: customConfig,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.queryByTestId("delete-button")).toBeNull();
    });

    it("saves all custom fields including baseURL/name/models/defaultModel", async () => {
      const onsave = vi.fn();
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: { ...customConfig, apiKey: "" },
        unconfiguredPresets: [],
        onsave,
        oncancel: () => {},
        ondelete: () => {},
      });
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "sk-x" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));
      expect(onsave.mock.calls[0][0]).toMatchObject({
        providerId: "mycustom",
        apiKey: "sk-x",
        selectedModel: "m1",
        baseURL: "https://api.custom.com/v1",
        name: "MyCustom",
        models: ["m1", "m2"],
        defaultModel: "m1",
      });
      expect(onsave.mock.calls[0][1]).toBe(false);
    });

    it("calls window.confirm then ondelete when delete clicked and confirmed", async () => {
      const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
      const ondelete = vi.fn();
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: customConfig,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
        ondelete,
      });
      await fireEvent.click(screen.getByTestId("delete-button"));
      expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
      expect(ondelete).toHaveBeenCalledWith("mycustom");
    });

    it("does NOT call ondelete when confirm returns false", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const ondelete = vi.fn();
      render(ProviderEditor, {
        mode: "edit",
        provider: customProvider,
        config: customConfig,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
        ondelete,
      });
      await fireEvent.click(screen.getByTestId("delete-button"));
      expect(ondelete).not.toHaveBeenCalled();
    });
  });

  describe("new mode picker", () => {
    it("shows editor-picker with preset, openai-compat and custom options", () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.getByTestId("editor-picker")).toBeInTheDocument();
      expect(screen.getByTestId("preset-option")).toBeInTheDocument();
      expect(screen.getByTestId("openai-compat-option")).toBeInTheDocument();
      expect(screen.getByTestId("custom-option")).toBeInTheDocument();
    });

    it("shows NO_UNCONFIGURED_PRESETS message when picking preset with none available", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("preset-option"));
      expect(
        screen.getByText("추가 가능한 프리셋이 없습니다."),
      ).toBeInTheDocument();
    });

    it("renders preset-select when picking preset with available presets", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [makePresetProvider()],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("preset-option"));
      expect(screen.getByTestId("preset-select")).toBeInTheDocument();
    });

    it("renders cancel button in new mode", () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
    });

    it("calls oncancel when cancel clicked", async () => {
      const oncancel = vi.fn();
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel,
      });
      await fireEvent.click(screen.getByTestId("cancel-button"));
      expect(oncancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("new custom flow", () => {
    it("shows the custom definition form after picking custom option", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("custom-option"));
      expect(screen.getByTestId("name-input")).toBeInTheDocument();
      expect(screen.getByTestId("base-url-input")).toBeInTheDocument();
      expect(screen.getByTestId("models-input")).toBeInTheDocument();
      expect(screen.getByTestId("default-model-select")).toBeInTheDocument();
    });

    it("disables save until the custom form is valid", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("custom-option"));
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(true);

      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "NewCustom" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.new.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1, m2" },
      });
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it("generates a custom- prefixed id and saves all fields", async () => {
      const onsave = vi.fn();
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave,
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("custom-option"));
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "NewCustom" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.new.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1, m2" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(onsave).toHaveBeenCalledTimes(1);
      const [savedConfig, isNew] = onsave.mock.calls[0];
      expect(savedConfig.providerId).toMatch(/^custom-/);
      expect(savedConfig).toMatchObject({
        apiKey: "",
        selectedModel: "m1",
        baseURL: "https://api.new.com/v1",
        name: "NewCustom",
        models: ["m1", "m2"],
        defaultModel: "m1",
      });
      expect(isNew).toBe(true);
    });
  });

  describe("new openai-compat flow", () => {
    it("shows the custom definition form after picking the openai-compat option", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      expect(screen.getByTestId("name-input")).toBeInTheDocument();
      expect(screen.getByTestId("base-url-input")).toBeInTheDocument();
      expect(screen.getByTestId("models-input")).toBeInTheDocument();
      expect(screen.getByTestId("default-model-select")).toBeInTheDocument();
    });

    it("pre-fills name and models but leaves baseURL empty for the user", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      expect(
        (screen.getByTestId("name-input") as HTMLInputElement).value,
      ).toBe("OpenAI 호환");
      expect(
        (screen.getByTestId("models-input") as HTMLInputElement).value,
      ).toBe("gpt-5.4, gpt-5.4-mini");
      expect(
        (screen.getByTestId("base-url-input") as HTMLInputElement).value,
      ).toBe("");
    });

    it("disables save until baseURL is filled (other fields pre-filled/valid)", async () => {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(true);

      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.openrouter.ai/v1" },
      });
      expect(
        (screen.getByTestId("save-button") as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it("saves with a custom- id and the pre-filled models after entering baseURL", async () => {
      const onsave = vi.fn();
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave,
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("openai-compat-option"));
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.openrouter.ai/v1" },
      });
      await fireEvent.click(screen.getByTestId("save-button"));

      expect(onsave).toHaveBeenCalledTimes(1);
      const [savedConfig, isNew] = onsave.mock.calls[0];
      expect(savedConfig.providerId).toMatch(/^custom-/);
      expect(savedConfig).toMatchObject({
        baseURL: "https://api.openrouter.ai/v1",
        name: "OpenAI 호환",
        models: ["gpt-5.4", "gpt-5.4-mini"],
        defaultModel: "gpt-5.4-mini",
        selectedModel: "gpt-5.4-mini",
      });
      expect(isNew).toBe(true);
    });
  });

  describe("validation errors", () => {
    async function renderNewCustom() {
      render(ProviderEditor, {
        mode: "new",
        provider: undefined,
        config: undefined,
        unconfiguredPresets: [],
        onsave: () => {},
        oncancel: () => {},
      });
      await fireEvent.click(screen.getByTestId("custom-option"));
    }

    it("shows error-name when name is empty (after entering other fields)", async () => {
      await renderNewCustom();
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.x.com/v1" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      expect(screen.getByTestId("error-name")).toHaveTextContent(
        "이름을 입력하세요.",
      );
    });

    it("shows error-base-url when baseURL is empty", async () => {
      await renderNewCustom();
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      expect(screen.getByTestId("error-base-url")).toHaveTextContent(
        "Base URL을 입력하세요.",
      );
    });

    it("shows error-base-url (invalid) when baseURL is malformed", async () => {
      await renderNewCustom();
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "not-a-url" },
      });
      await fireEvent.input(screen.getByTestId("models-input"), {
        target: { value: "m1" },
      });
      expect(screen.getByTestId("error-base-url").textContent ?? "").toContain(
        "올바른 URL",
      );
    });

    it("shows error-models when no models entered", async () => {
      await renderNewCustom();
      await fireEvent.input(screen.getByTestId("name-input"), {
        target: { value: "X" },
      });
      await fireEvent.input(screen.getByTestId("base-url-input"), {
        target: { value: "https://api.x.com/v1" },
      });
      expect(screen.getByTestId("error-models")).toHaveTextContent(
        "최소 한 개의 모델을 입력하세요.",
      );
    });
  });
});
