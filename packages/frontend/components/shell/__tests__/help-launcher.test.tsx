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
    vi.spyOn(global, "fetch").mockImplementation(() => Promise.resolve(Response.json({})));
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

  // ONB-V1-TASK-004 AC-004-01/04: same route-conditional deep-link pattern
  // as CompletenessTourEntry, on /explorer since that's the trust-mechanics
  // tour's owning surface.
  it("offers the trust-mechanics tour deep-link only on Explorer routes (AC-004-01)", () => {
    pathname = "/explorer";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("link", { name: /take the trust-mechanics tour/i })).toHaveAttribute(
      "href",
      "/explorer?tour=trust-mechanics",
    );
  });

  it("does not offer the trust-mechanics tour deep-link off Explorer routes", () => {
    pathname = "/dashboard";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.queryByRole("link", { name: /take the trust-mechanics tour/i })).not.toBeInTheDocument();
  });

  // ONB-V1-TASK-004 AC-004-05: rules-policies deep-link shows on the CE
  // rules route for every role -- role tailoring only affects the
  // *proactive* offer (availableTours), never this launcher entry, so
  // Business/Admin get a real link here instead of a dead CTA.
  it("offers the rules-policies tour deep-link only on the CE rules route (AC-004-05)", () => {
    pathname = "/ce/rules";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.getByRole("link", { name: /take the rules-policies tour/i })).toHaveAttribute(
      "href",
      "/ce/rules?tour=rules-policies",
    );
  });

  it("does not offer the rules-policies tour deep-link off the CE rules route", () => {
    pathname = "/ce";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));

    expect(screen.queryByRole("link", { name: /take the rules-policies tour/i })).not.toBeInTheDocument();
  });

  // S4 (docs/design/remediation-2-api-gaps.md): the rail's bottom "?" (in
  // nav.tsx) is a separate DOM element from this launcher's own trigger, so
  // it opens the SAME panel via a shared window event -- the identical
  // pattern command-palette.tsx already uses for its header trigger.
  it("opens on the shared weave:open-help-panel window event", () => {
    render(<HelpLauncher />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent(window, new CustomEvent("weave:open-help-panel"));

    expect(screen.getByRole("dialog", { name: /help/i })).toBeInTheDocument();
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

    it("stays open when ? is pressed again while already open (no toggle-close)", () => {
      render(<HelpLauncher />);
      fireEvent.keyDown(document.body, { key: "?" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: "?" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  describe("Get going cards (HelpPanel extraction)", () => {
    it("renders the docs and support cards as real links", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("link", { name: /docs & concepts/i })).toHaveAttribute("href", "/ce/glossary");
      expect(screen.getByRole("link", { name: /contact support/i })).toHaveAttribute(
        "href",
        "mailto:support@weave.app",
      );
    });

    it("closes the panel and starts the guided tour when the tour card is clicked", () => {
      render(<HelpLauncher />);
      fireEvent.click(screen.getByRole("button", { name: /help/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /guided tour/i }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("has zero axe violations (AC-013-06)", async () => {
    pathname = "/ce";
    render(<HelpLauncher />);
    fireEvent.click(screen.getByRole("button", { name: /help/i }));
    // The panel is a Radix Dialog.Portal -- it renders into document.body,
    // not into the render()'d container, so the axe scan must cover
    // document.body to actually reach the panel's links/headings.
    await expectNoAxeViolations(document.body);
  });
});
