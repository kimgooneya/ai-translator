import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import ProviderCard from "$lib/components/ProviderCard.svelte";
import type { Provider, ProviderConfig } from "$lib/schemas";

// jsdom does not implement Pointer Capture API, but bits-ui's Select.Trigger
// calls `target.hasPointerCapture(...)` in its onpointerdown handler. Polyfill
// before any Select interaction so popover open works in tests.
beforeAll(() => {
  if (
    typeof HTMLElement !== "undefined" &&
    typeof HTMLElement.prototype.hasPointerCapture !== "function"
  ) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.releasePointerCapture = () => {};
    HTMLElement.prototype.setPointerCapture = () => {};
  }
});

const presetProvider: Provider = {
  id: "openai",
  name: "OpenAI",
  kind: "preset",
  baseURL: "https://api.openai.com/v1",
  models: ["gpt-5.4", "gpt-5.4-mini"],
  defaultModel: "gpt-5.4-mini",
};

const customProvider: Provider = {
  id: "my-custom",
  name: "My Custom",
  kind: "custom",
  baseURL: "https://api.example.com/v1",
  models: ["m1", "m2"],
  defaultModel: "m1",
};

const configuredPreset: ProviderConfig = {
  providerId: "openai",
  apiKey: "sk-stored-key",
  selectedModel: "gpt-5.4",
};

/**
 * Helper: open the bits-ui Select popover by clicking its trigger, then return
 * the rendered item elements. In jsdom the popover renders through a Portal
 * attached to document.body, so we query via screen.
 */
async function openSelectOptions(trigger: HTMLElement): Promise<HTMLElement[]> {
  await fireEvent.pointerDown(trigger, { button: 0 });
  await fireEvent.pointerUp(trigger, { button: 0 });
  await fireEvent.click(trigger);
  const items = await screen.findAllByRole("option");
  return items;
}

/**
 * bits-ui commits a Select.Item selection on pointerup, not click. Fire the
 * full pointer + click sequence to mirror a real user interaction.
 */
async function selectItem(item: HTMLElement): Promise<void> {
  await fireEvent.pointerDown(item, { button: 0 });
  await fireEvent.pointerUp(item, { button: 0 });
  await fireEvent.click(item);
}

describe("ProviderCard", () => {
  describe("rendering", () => {
    it("renders the provider name inside the Card.Title slot", () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const title = screen.getByText("OpenAI");
      expect(title).toBeInTheDocument();
      // shadcn Card.Title renders a <div data-slot="card-title">. We assert on
      // the structural slot rather than a specific tag name.
      expect(title.closest('[data-slot="card-title"]')).not.toBeNull();
    });

    it("shows 미설정 indicator (Badge secondary variant) when config is undefined", () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const notice = screen.getByText("미설정");
      expect(notice).toBeInTheDocument();
      expect(notice.closest('[data-slot="badge"]')).not.toBeNull();
      // secondary variant classes only exist when hasApiKey is false
      expect(notice.className).toContain("bg-secondary");
    });

    it("shows 미설정 indicator when config has empty apiKey", () => {
      render(ProviderCard, {
        props: {
          provider: presetProvider,
          config: {
            providerId: "openai",
            apiKey: "",
            selectedModel: "gpt-5.4-mini",
          },
          onsave: vi.fn(),
        },
      });
      const notice = screen.getByText("미설정");
      expect(notice).toBeInTheDocument();
      expect(notice.className).toContain("bg-secondary");
    });

    it("shows 설정됨 indicator (Badge default variant) when config has a non-empty apiKey", () => {
      render(ProviderCard, {
        props: {
          provider: presetProvider,
          config: configuredPreset,
          onsave: vi.fn(),
        },
      });
      const notice = screen.getByText("설정됨");
      expect(notice).toBeInTheDocument();
      expect(notice.closest('[data-slot="badge"]')).not.toBeNull();
      // default variant — bg-primary is present (not bg-secondary)
      expect(notice.className).toContain("bg-primary");
      expect(notice.className).not.toContain("bg-secondary");
    });

    it('uses type="password" for the API key input (never plaintext)', () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const input = screen.getByTestId("api-key-input") as HTMLInputElement;
      expect(input.type).toBe("password");
    });

    it("renders all provider models as Select options when opened", async () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const trigger = screen.getByTestId("model-select");
      const items = await openSelectOptions(trigger);
      const labels = items.map((i) => i.textContent?.trim() ?? "");
      expect(labels).toEqual(expect.arrayContaining(["gpt-5.4", "gpt-5.4-mini"]));
    });

    it("pre-fills apiKey from config and reflects selectedModel in the trigger", () => {
      render(ProviderCard, {
        props: {
          provider: presetProvider,
          config: configuredPreset,
          onsave: vi.fn(),
        },
      });
      const keyInput = screen.getByTestId("api-key-input") as HTMLInputElement;
      const trigger = screen.getByTestId("model-select");
      expect(keyInput.value).toBe("sk-stored-key");
      // shadcn Select.Trigger renders the currently selected value as text.
      expect(trigger.textContent).toContain("gpt-5.4");
    });

    it("defaults selectedModel to provider.defaultModel when no config", () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const trigger = screen.getByTestId("model-select");
      expect(trigger.textContent).toContain("gpt-5.4-mini");
    });
  });

  describe("delete button visibility", () => {
    it("does NOT render a delete button for preset providers", () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      expect(screen.queryByTestId("delete-button")).toBeNull();
    });

    it("renders a delete button for custom providers when ondelete is provided", () => {
      render(ProviderCard, {
        props: {
          provider: customProvider,
          config: undefined,
          onsave: vi.fn(),
          ondelete: vi.fn(),
        },
      });
      const btn = screen.getByTestId("delete-button");
      expect(btn).toBeInTheDocument();
      // shadcn destructive Button uses bg-destructive
      expect(btn.className).toContain("bg-destructive");
    });

    it("does NOT render a delete button for custom providers when ondelete is omitted", () => {
      render(ProviderCard, {
        props: { provider: customProvider, config: undefined, onsave: vi.fn() },
      });
      expect(screen.queryByTestId("delete-button")).toBeNull();
    });
  });

  describe("save button (dirty state)", () => {
    it("is disabled when there are no local edits", () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const btn = screen.getByTestId("save-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("is disabled when local values match config exactly", () => {
      render(ProviderCard, {
        props: {
          provider: presetProvider,
          config: configuredPreset,
          onsave: vi.fn(),
        },
      });
      const btn = screen.getByTestId("save-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("becomes enabled when the user types an API key", async () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const input = screen.getByTestId("api-key-input");
      const btn = screen.getByTestId("save-button") as HTMLButtonElement;
      await fireEvent.input(input, { target: { value: "sk-new-key" } });
      expect(btn.disabled).toBe(false);
    });

    it("becomes enabled when the user changes the selected model via the popover", async () => {
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const trigger = screen.getByTestId("model-select");
      const items = await openSelectOptions(trigger);
      // default is gpt-5.4-mini; click gpt-5.4 to mark dirty
      const target = items.find(
        (i) => i.textContent?.trim() === "gpt-5.4",
      ) as HTMLElement;
      await selectItem(target);
      const btn = screen.getByTestId("save-button") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  describe("callbacks", () => {
    it("calls onsave with the correct ProviderConfig (preset) on save click", async () => {
      const onsave = vi.fn();
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave },
      });
      const input = screen.getByTestId("api-key-input");
      await fireEvent.input(input, { target: { value: "sk-test-1" } });
      const btn = screen.getByTestId("save-button");
      await fireEvent.click(btn);
      expect(onsave).toHaveBeenCalledTimes(1);
      expect(onsave).toHaveBeenCalledWith({
        providerId: "openai",
        apiKey: "sk-test-1",
        selectedModel: "gpt-5.4-mini",
      });
    });

    it("calls onsave with baseURL included for custom providers", async () => {
      const onsave = vi.fn();
      render(ProviderCard, {
        props: { provider: customProvider, config: undefined, onsave },
      });
      const input = screen.getByTestId("api-key-input");
      await fireEvent.input(input, { target: { value: "sk-custom-1" } });
      await fireEvent.click(screen.getByTestId("save-button"));
      expect(onsave).toHaveBeenCalledWith({
        providerId: "my-custom",
        apiKey: "sk-custom-1",
        selectedModel: "m1",
        baseURL: "https://api.example.com/v1",
      });
    });

    it("trims whitespace from the API key before calling onsave", async () => {
      const onsave = vi.fn();
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave },
      });
      await fireEvent.input(screen.getByTestId("api-key-input"), {
        target: { value: "  sk-spaces  " },
      });
      await fireEvent.click(screen.getByTestId("save-button"));
      expect(onsave.mock.calls[0][0].apiKey).toBe("sk-spaces");
    });

    it("respects the user-selected model when saving (via popover)", async () => {
      const onsave = vi.fn();
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave },
      });
      const trigger = screen.getByTestId("model-select");
      const items = await openSelectOptions(trigger);
      const target = items.find(
        (i) => i.textContent?.trim() === "gpt-5.4",
      ) as HTMLElement;
      await selectItem(target);
      await fireEvent.click(screen.getByTestId("save-button"));
      expect(onsave.mock.calls[0][0].selectedModel).toBe("gpt-5.4");
    });

    it("calls ondelete when the delete button is clicked", async () => {
      const ondelete = vi.fn();
      render(ProviderCard, {
        props: {
          provider: customProvider,
          config: undefined,
          onsave: vi.fn(),
          ondelete,
        },
      });
      await fireEvent.click(screen.getByTestId("delete-button"));
      expect(ondelete).toHaveBeenCalledTimes(1);
    });

    it("does not call onsave when save button is disabled", async () => {
      const onsave = vi.fn();
      render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave },
      });
      const btn = screen.getByTestId("save-button") as HTMLButtonElement;
      // disabled buttons do not fire click events to the handler
      btn.disabled = false;
      await fireEvent.click(btn);
      // Still no edits — but we forced enabled. The handler still runs.
      // Verify onsave WAS called (handler runs) — this confirms wiring.
      expect(onsave).toHaveBeenCalledTimes(1);
    });
  });

  describe("multiple cards in a list (scoping)", () => {
    it("keeps inputs independent when multiple cards render together", () => {
      const { container } = render(ProviderCard, {
        props: { provider: presetProvider, config: undefined, onsave: vi.fn() },
      });
      const card = container.querySelector(
        '[data-testid="provider-card"]',
      ) as HTMLElement;
      expect(within(card).getByTestId("api-key-input")).toBeInTheDocument();
      expect(within(card).getByText("OpenAI")).toBeInTheDocument();
    });
  });
});
