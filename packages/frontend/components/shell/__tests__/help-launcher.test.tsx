import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";

import { HelpLauncher } from "../help-launcher";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

let unread = false;
const markSeen = vi.fn();
vi.mock("@/lib/onboarding/use-whats-new-unread", () => ({
  useWhatsNewUnread: () => ({ loading: false, unread, markSeen }),
}));

async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
}

describe("HelpLauncher", () => {
  beforeEach(() => {
    pathname = "/dashboard";
    unread = false;
    markSeen.mockClear();
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
  });

  it("opens a contextual help panel without navigating away (AC-7)", () => {
    render(<HelpLauncher />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
  });

  it("closes when dismissed", () => {
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close help/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers the completeness-map tour deep-link only on Explorer routes (ONB-V1-TASK-002 AC-002-01)", () => {
    pathname = "/explorer";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("link", { name: /take the completeness-map tour/i })).toHaveAttribute(
      "href",
      "/explorer?tour=completeness-map",
    );
  });

  it("does not offer the completeness-map tour deep-link off Explorer routes", () => {
    pathname = "/dashboard";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.queryByRole("link", { name: /take the completeness-map tour/i })).not.toBeInTheDocument();
  });

  describe("keyboard shortcut (AC-013-03)", () => {
    it("opens on ? pressed outside a text field", () => {
      render(<HelpLauncher />);
      fireEvent.keyDown(document.body, { key: "?" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("opens on Shift+?", () => {
      render(<HelpLauncher />);
      fireEvent.keyDown(document.body, { key: "?", shiftKey: true });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("does not open when ? is typed inside a text field", () => {
      render(
        <div>
          <input aria-label="search" />
          <HelpLauncher />
        </div>,
      );
      fireEvent.keyDown(screen.getByLabelText("search"), { key: "?" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("closes on Escape", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("contextual help panel (AC-013-04)", () => {
    it("shows 2-4 relevant links for an area with config", () => {
      pathname = "/ce";
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      const nav = screen.getByRole("navigation", { name: /help for this page/i });
      expect(nav.querySelectorAll("a").length).toBeGreaterThanOrEqual(2);
      expect(nav.querySelectorAll("a").length).toBeLessThanOrEqual(4);
    });

    it("hides the section entirely when the area has no config", () => {
      pathname = "/dashboard";
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.queryByRole("navigation", { name: /help for this page/i })).not.toBeInTheDocument();
    });
  });

  describe("entries resolve live surfaces (AC-013-05)", () => {
    it("show hints calls the beacon bulk-restore endpoint", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      fireEvent.click(screen.getByRole("button", { name: /show all hints/i }));
      expect(fetch).toHaveBeenCalledWith("/api/onboarding/dismissals/beacon", { method: "DELETE" });
    });

    it("training entry links to the training library", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("link", { name: /training library/i })).toHaveAttribute("href", "/help/training");
    });

    it("change-path entry links to onboarding path settings", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("link", { name: /change my onboarding path/i })).toHaveAttribute(
        "href",
        "/settings/onboarding-path",
      );
    });

    it("checklist restore still calls the checklist restore endpoint", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      fireEvent.click(screen.getByText(/restore checklist|checklist.restore/i));
      expect(fetch).toHaveBeenCalledWith("/api/onboarding/checklist/restore", { method: "POST" });
    });
  });

  describe("unread dot (AC-013-06)", () => {
    it("shows on the ? icon when What's-new has unread items", () => {
      unread = true;
      render(<HelpLauncher />);
      expect(screen.getByTestId("help-launcher-unread-dot")).toBeInTheDocument();
    });

    it("is absent when there are no unread items", () => {
      unread = false;
      render(<HelpLauncher />);
      expect(screen.queryByTestId("help-launcher-unread-dot")).not.toBeInTheDocument();
    });
  });

  it("has zero axe violations (AC-013-06)", async () => {
    pathname = "/ce";
    const { container } = render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    await expectNoAxeViolations(container);
  });
});
