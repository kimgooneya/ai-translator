import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/svelte";
import Page from "./+page.svelte";

describe("Settings page", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the page heading", () => {
    render(Page);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the security notice", () => {
    render(Page);
    expect(screen.getByTestId("security-notice")).toBeInTheDocument();
  });
});
