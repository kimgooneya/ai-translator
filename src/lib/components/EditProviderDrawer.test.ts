import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import EditProviderDrawer from "./EditProviderDrawer.svelte";
import type { Provider, ProviderConfig } from "$lib/schemas";

function makePresetProvider(overrides: Partial<Provider> = {}): Provider {
	return {
		id: "openai",
		name: "OpenAI",
		kind: "preset",
		baseURL: "https://api.openai.com/v1",
		models: ["gpt-4", "gpt-3.5"],
		defaultModel: "gpt-4",
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
		selectedModel: "gpt-4",
		...overrides,
	};
}

describe("EditProviderDrawer", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("rendering", () => {
		it("shows the drawer content with provider name", () => {
			const provider = makePresetProvider();
			render(EditProviderDrawer, {
				open: true,
				provider,
				config: makeConfig({ providerId: "openai" }),
				onsave: () => {},
			});
			expect(screen.getByTestId("edit-provider-drawer")).toBeInTheDocument();
		});

		it("renders an apiKey input with type=password (behavior preservation)", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave: () => {},
			});
			const input = screen.getByTestId("api-key-input") as HTMLInputElement;
			expect(input.type).toBe("password");
		});

		it("renders a model select trigger", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave: () => {},
			});
			expect(screen.getByTestId("model-select")).toBeInTheDocument();
		});

		it("does NOT render baseURL input for preset providers", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave: () => {},
			});
			expect(screen.queryByTestId("base-url-input")).toBeNull();
		});

		it("renders baseURL input for custom providers", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makeCustomProvider(),
				config: makeConfig({
					providerId: "mycustom",
					selectedModel: "m1",
					baseURL: "https://api.custom.com/v1",
				}),
				onsave: () => {},
			});
			expect(screen.getByTestId("base-url-input")).toBeInTheDocument();
		});
	});

	describe("dirty tracking (behavior preservation)", () => {
		it("disables save button when no changes made", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig({ apiKey: "sk-existing" }),
				onsave: () => {},
			});
			expect(
				(screen.getByTestId("save-button") as HTMLButtonElement).disabled,
			).toBe(true);
		});

		it("enables save button after apiKey change", async () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig({ apiKey: "sk-existing" }),
				onsave: () => {},
			});
			await fireEvent.input(screen.getByTestId("api-key-input"), {
				target: { value: "sk-new" },
			});
			expect(
				(screen.getByTestId("save-button") as HTMLButtonElement).disabled,
			).toBe(false);
		});
	});

	describe("save behavior", () => {
		it("trims apiKey on save (behavior preservation)", async () => {
			const onsave = vi.fn();
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig({ apiKey: "" }),
				onsave,
			});
			await fireEvent.input(screen.getByTestId("api-key-input"), {
				target: { value: "  sk-trimmed  " },
			});
			await fireEvent.click(screen.getByTestId("save-button"));
			expect(onsave).toHaveBeenCalledWith(
				expect.objectContaining({ apiKey: "sk-trimmed" }),
			);
		});

		it("does NOT include baseURL for preset providers (behavior preservation)", async () => {
			const onsave = vi.fn();
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave,
			});
			await fireEvent.input(screen.getByTestId("api-key-input"), {
				target: { value: "sk-x" },
			});
			await fireEvent.click(screen.getByTestId("save-button"));
			const savedArg = onsave.mock.calls[0][0];
			expect(savedArg.baseURL).toBeUndefined();
		});

		it("includes baseURL for custom providers (behavior preservation)", async () => {
			const onsave = vi.fn();
			const provider = makeCustomProvider();
			render(EditProviderDrawer, {
				open: true,
				provider,
				config: makeConfig({
					providerId: "mycustom",
					selectedModel: "m1",
					baseURL: "https://api.custom.com/v1",
				}),
				onsave,
			});
			await fireEvent.input(screen.getByTestId("api-key-input"), {
				target: { value: "sk-x" },
			});
			await fireEvent.click(screen.getByTestId("save-button"));
			expect(onsave).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://api.custom.com/v1",
				}),
			);
		});
	});

	describe("delete behavior", () => {
		it("does NOT render delete button for preset providers", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave: () => {},
			});
			expect(screen.queryByTestId("delete-button")).toBeNull();
		});

		it("renders delete button for custom providers", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makeCustomProvider(),
				config: makeConfig({
					providerId: "mycustom",
					selectedModel: "m1",
					baseURL: "https://api.custom.com/v1",
				}),
				onsave: () => {},
				ondelete: () => {},
			});
			expect(screen.getByTestId("delete-button")).toBeInTheDocument();
		});

		it("calls window.confirm with Korean message on delete (behavior preservation)", async () => {
			const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
			const ondelete = vi.fn();
			render(EditProviderDrawer, {
				open: true,
				provider: makeCustomProvider(),
				config: makeConfig({
					providerId: "mycustom",
					selectedModel: "m1",
					baseURL: "https://api.custom.com/v1",
				}),
				onsave: () => {},
				ondelete,
			});
			await fireEvent.click(screen.getByTestId("delete-button"));
			expect(confirmSpy).toHaveBeenCalledWith("정말 삭제하시겠습니까?");
			expect(ondelete).toHaveBeenCalledTimes(1);
		});

		it("does NOT call ondelete when confirm returns false", async () => {
			vi.spyOn(window, "confirm").mockReturnValue(false);
			const ondelete = vi.fn();
			render(EditProviderDrawer, {
				open: true,
				provider: makeCustomProvider(),
				config: makeConfig({
					providerId: "mycustom",
					selectedModel: "m1",
					baseURL: "https://api.custom.com/v1",
				}),
				onsave: () => {},
				ondelete,
			});
			await fireEvent.click(screen.getByTestId("delete-button"));
			expect(ondelete).not.toHaveBeenCalled();
		});
	});

	describe("no params fields (behavior preservation)", () => {
		it("does NOT render temperature or maxTokens inputs", () => {
			render(EditProviderDrawer, {
				open: true,
				provider: makePresetProvider(),
				config: makeConfig(),
				onsave: () => {},
			});
			expect(screen.queryByTestId("temperature-input")).toBeNull();
			expect(screen.queryByTestId("max-tokens-input")).toBeNull();
		});
	});
});
