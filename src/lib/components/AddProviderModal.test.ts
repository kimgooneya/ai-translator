import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import AddProviderModal from "./AddProviderModal.svelte";

describe("AddProviderModal", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("trigger and open", () => {
		it("renders a trigger button with the correct testid", () => {
			render(AddProviderModal, { onsave: () => {} });
			expect(screen.getByTestId("add-provider-button")).toBeInTheDocument();
		});

		it("opens the modal when the trigger is clicked", async () => {
			render(AddProviderModal, { onsave: () => {} });
			await fireEvent.click(screen.getByTestId("add-provider-button"));
			expect(screen.getByTestId("add-provider-modal")).toBeInTheDocument();
		});
	});

	describe("form fields", () => {
		async function openModal() {
			render(AddProviderModal, { onsave: () => {} });
			await fireEvent.click(screen.getByTestId("add-provider-button"));
		}

		it("renders name, baseURL, and models inputs", async () => {
			await openModal();
			expect(screen.getByTestId("add-name-input")).toBeInTheDocument();
			expect(screen.getByTestId("add-base-url-input")).toBeInTheDocument();
			expect(screen.getByTestId("add-models-input")).toBeInTheDocument();
		});

		it("renders a default-model select trigger", async () => {
			await openModal();
			expect(screen.getByTestId("add-default-model-select")).toBeInTheDocument();
		});
	});

	describe("validation", () => {
		async function openAndSubmit(fields: {
			name?: string;
			baseURL?: string;
			models?: string;
		}) {
			render(AddProviderModal, { onsave: () => {} });
			await fireEvent.click(screen.getByTestId("add-provider-button"));
			if (fields.name !== undefined) {
				await fireEvent.input(screen.getByTestId("add-name-input"), {
					target: { value: fields.name },
				});
			}
			if (fields.baseURL !== undefined) {
				await fireEvent.input(screen.getByTestId("add-base-url-input"), {
					target: { value: fields.baseURL },
				});
			}
			if (fields.models !== undefined) {
				await fireEvent.input(screen.getByTestId("add-models-input"), {
					target: { value: fields.models },
				});
			}
			await fireEvent.click(screen.getByTestId("add-submit-button"));
		}

		it("shows Korean error when name is empty", async () => {
			await openAndSubmit({
				baseURL: "https://api.example.com/v1",
				models: "m1",
			});
			expect(screen.getByTestId("error-name")).toHaveTextContent(
				"이름을 입력하세요.",
			);
		});

		it("shows Korean error when baseURL is empty", async () => {
			await openAndSubmit({ name: "X", models: "m1" });
			expect(screen.getByTestId("error-base-url")).toHaveTextContent(
				"Base URL을 입력하세요.",
			);
		});

		it("shows URL format error for invalid baseURL", async () => {
			await openAndSubmit({
				name: "X",
				baseURL: "not-a-url",
				models: "m1",
			});
			expect(screen.getByTestId("error-base-url")).toHaveTextContent(/URL/);
		});

		it("shows Korean error when models is empty", async () => {
			await openAndSubmit({
				name: "X",
				baseURL: "https://api.x.com/v1",
			});
			expect(screen.getByTestId("error-models")).toHaveTextContent(
				"최소 한 개의 모델을 입력하세요.",
			);
		});

		it("does NOT call onsave when validation fails", async () => {
			const onsave = vi.fn();
			render(AddProviderModal, { onsave });
			await fireEvent.click(screen.getByTestId("add-provider-button"));
			await fireEvent.click(screen.getByTestId("add-submit-button"));
			expect(onsave).not.toHaveBeenCalled();
		});
	});

	describe("submit (happy path)", () => {
		it("calls onsave with parsed data on valid submit", async () => {
			const onsave = vi.fn();
			render(AddProviderModal, { onsave });
			await fireEvent.click(screen.getByTestId("add-provider-button"));

			await fireEvent.input(screen.getByTestId("add-name-input"), {
				target: { value: "MyProvider" },
			});
			await fireEvent.input(screen.getByTestId("add-base-url-input"), {
				target: { value: "https://api.example.com/v1" },
			});
			await fireEvent.input(screen.getByTestId("add-models-input"), {
				target: { value: "gpt-4, gpt-3.5" },
			});

			await fireEvent.click(screen.getByTestId("add-submit-button"));

			expect(onsave).toHaveBeenCalledTimes(1);
			expect(onsave).toHaveBeenCalledWith({
				name: "MyProvider",
				baseURL: "https://api.example.com/v1",
				models: ["gpt-4", "gpt-3.5"],
				defaultModel: "gpt-4",
			});
		});

		it("resets form fields after successful submit", async () => {
			const onsave = vi.fn();
			render(AddProviderModal, { onsave });
			await fireEvent.click(screen.getByTestId("add-provider-button"));

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

			// Modal closes after submit; re-open to verify fields were reset
			await fireEvent.click(screen.getByTestId("add-provider-button"));

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
	});
});
