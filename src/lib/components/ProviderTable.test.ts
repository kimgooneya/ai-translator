import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import ProviderTable from "./ProviderTable.svelte";
import type { Provider, ProviderConfig } from "$lib/schemas";

function makePreset(id: string, name: string, overrides: Partial<Provider> = {}): Provider {
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

function makeCustom(id: string, name: string, overrides: Partial<Provider> = {}): Provider {
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

function makeConfig(providerId: string, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
	return {
		providerId,
		apiKey: "",
		selectedModel: "model-a",
		...overrides,
	};
}

describe("ProviderTable", () => {
	describe("rendering", () => {
		it("renders the table container", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getByTestId("provider-table")).toBeInTheDocument();
		});

		it("renders a row for each provider", () => {
			const providers = [
				makePreset("openai", "OpenAI"),
				makePreset("gemini", "Google Gemini"),
				makeCustom("mycustom", "MyCustom"),
			];
			render(ProviderTable, {
				providers,
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByTestId("provider-row")).toHaveLength(3);
		});

		it("sets data-provider-id on each row", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			const row = screen.getAllByTestId("provider-row")[0];
			expect(row.getAttribute("data-provider-id")).toBe("openai");
		});

		it("shows provider name in each row", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByText("OpenAI").length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("kind column", () => {
		it("shows 프리셋 for preset providers", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByText("프리셋").length).toBeGreaterThanOrEqual(1);
		});

		it("shows 커스텀 for custom providers", () => {
			render(ProviderTable, {
				providers: [makeCustom("mycustom", "MyCustom")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByText("커스텀").length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("API key status", () => {
		it("shows 미설정 when no config exists", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByText("미설정").length).toBeGreaterThanOrEqual(1);
		});

		it("shows 설정됨 when config has apiKey", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [makeConfig("openai", { apiKey: "sk-xxx" })],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByText("설정됨").length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("active provider", () => {
		it("shows 활성 badge on the active provider row", () => {
			render(ProviderTable, {
				providers: [
					makePreset("openai", "OpenAI"),
					makePreset("gemini", "Gemini"),
				],
				configs: [],
				activeProviderId: "openai",
				onEdit: () => {},
				onSetActive: () => {},
			});
			const openaiRow = screen
				.getAllByTestId("provider-row")
				.find((r) => r.getAttribute("data-provider-id") === "openai") as HTMLElement;
			expect(within(openaiRow).getByTestId("active-badge")).toBeInTheDocument();
			expect(within(openaiRow).getByText("활성")).toBeInTheDocument();
		});

		it("shows set-active button on non-active rows", () => {
			render(ProviderTable, {
				providers: [
					makePreset("openai", "OpenAI"),
					makePreset("gemini", "Gemini"),
				],
				configs: [],
				activeProviderId: "openai",
				onEdit: () => {},
				onSetActive: () => {},
			});
			const geminiRow = screen
				.getAllByTestId("provider-row")
				.find((r) => r.getAttribute("data-provider-id") === "gemini") as HTMLElement;
			expect(within(geminiRow).getByTestId("set-active-button")).toBeInTheDocument();
		});

		it("does NOT show set-active button on active row", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: "openai",
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.queryByTestId("set-active-button")).toBeNull();
		});

		it("calls onSetActive with providerId when set-active clicked", async () => {
			const onSetActive = vi.fn();
			render(ProviderTable, {
				providers: [
					makePreset("openai", "OpenAI"),
					makePreset("gemini", "Gemini"),
				],
				configs: [],
				activeProviderId: "openai",
				onEdit: () => {},
				onSetActive,
			});
			await fireEvent.click(screen.getAllByTestId("set-active-button")[0]);
			expect(onSetActive).toHaveBeenCalledWith("gemini");
		});
	});

	describe("edit action", () => {
		it("renders an edit button on each row", () => {
			render(ProviderTable, {
				providers: [
					makePreset("openai", "OpenAI"),
					makePreset("gemini", "Gemini"),
				],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByTestId("edit-button").length).toBeGreaterThanOrEqual(2);
		});

		it("calls onEdit with providerId when edit clicked", async () => {
			const onEdit = vi.fn();
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit,
				onSetActive: () => {},
			});
			await fireEvent.click(screen.getAllByTestId("edit-button")[0]);
			expect(onEdit).toHaveBeenCalledWith("openai");
		});
	});

	describe("mobile view", () => {
		it("renders mobile card container alongside desktop table", () => {
			render(ProviderTable, {
				providers: [makePreset("openai", "OpenAI")],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getByTestId("provider-table-mobile")).toBeInTheDocument();
		});

		it("renders a card for each provider in mobile view", () => {
			render(ProviderTable, {
				providers: [
					makePreset("openai", "OpenAI"),
					makePreset("gemini", "Gemini"),
				],
				configs: [],
				activeProviderId: null,
				onEdit: () => {},
				onSetActive: () => {},
			});
			expect(screen.getAllByTestId("provider-card-mobile")).toHaveLength(2);
		});
	});
});
