import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingHintsHost } from "../onboarding-hints-host";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

interface MockState {
  dismissals: Array<{ kind: string; ref_id: string }>;
  rolePath?: string;
  activations?: Array<{ milestone_id: string; activated_at: string; source: string }>;
}

let mockState: MockState;

function mockFetch(url: string): Promise<Response> {
  if (url === "/api/onboarding/state") {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          dismissals: mockState.dismissals,
          role_path: mockState.rolePath ?? "business",
          activations: mockState.activations ?? [],
        }),
      ),
    );
  }
  if (url === "/api/onboarding/path") {
    return Promise.resolve(
      new Response(
        JSON.stringify({ role_path: "business", path_variant: "default", path_chosen_manually: false, needs_choice: false }),
      ),
    );
  }
  return Promise.resolve(new Response("{}"));
}

describe("OnboardingHintsHost", () => {
  beforeEach(() => {
    mockState = { dismissals: [] };
    vi.stubGlobal("fetch", vi.fn((url: string) => mockFetch(url)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the area's welcome modal once bootstrapped (AC-008-04)", async () => {
    mockUsePathname.mockReturnValue("/ce");
    render(
      <>
        <main data-tour-id="ce.versions" />
        <OnboardingHintsHost />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /welcome to constitution/i })).toBeInTheDocument();
    });
  });

  it("renders the area's beacon once the welcome modal is already dismissed (AC-008-01)", async () => {
    mockState = { dismissals: [{ kind: "welcome_modal", ref_id: "welcome-constitution" }] };
    mockUsePathname.mockReturnValue("/ce");
    render(
      <>
        <main data-tour-id="ce.versions" />
        <OnboardingHintsHost />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /hint available/i })).toBeInTheDocument();
    });
  });

  it("renders neither beacon nor modal for a flagged-off (unshipped) area (AC-008-06)", async () => {
    mockUsePathname.mockReturnValue("/events");
    render(<OnboardingHintsHost />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/onboarding/path", expect.anything());
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hint available/i })).not.toBeInTheDocument();
  });

  it("a dismissed beacon and dismissed modal do not render (AC-008-02/04)", async () => {
    mockState = {
      dismissals: [
        { kind: "beacon", ref_id: "ce-versions" },
        { kind: "welcome_modal", ref_id: "welcome-constitution" },
      ],
    };
    mockUsePathname.mockReturnValue("/ce");
    render(
      <>
        <main data-tour-id="ce.versions" />
        <OnboardingHintsHost />
      </>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/onboarding/state");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /hint available/i })).not.toBeInTheDocument();
  });

  it("ONB-V1-TASK-003 AC-003-03: shows the role-home beacon while add-competency-questions is open", async () => {
    mockState = {
      dismissals: [{ kind: "welcome_modal", ref_id: "welcome-role-home" }],
      rolePath: "business",
      activations: [],
    };
    mockUsePathname.mockReturnValue("/role-home");
    render(
      <>
        <main data-tour-id="plat.role-home.completeness-map" />
        <OnboardingHintsHost />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /hint available/i })).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/api\/ce\//));
  });

  it("ONB-V1-TASK-003 AC-003-03: hides the role-home beacon once the item is self-marked complete", async () => {
    mockState = {
      dismissals: [{ kind: "welcome_modal", ref_id: "welcome-role-home" }],
      rolePath: "business",
      activations: [{ milestone_id: "add_competency_questions", activated_at: "2026-01-01T00:00:00Z", source: "manual" }],
    };
    mockUsePathname.mockReturnValue("/role-home");
    render(
      <>
        <main data-tour-id="plat.role-home.completeness-map" />
        <OnboardingHintsHost />
      </>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/onboarding/state");
    });
    expect(screen.queryByRole("button", { name: /hint available/i })).not.toBeInTheDocument();
  });

  // Regression (ONB-V1-TASK-004 review): the host is mounted once in the app
  // shell and persists across route navigations, so ActiveTour must remount
  // (via key=tourId) when a second beacon's "Learn more" starts a different
  // tour -- otherwise the first tour's `started` ref blocks the second one.
  it("starts a second area's tour after a first beacon's Learn-more already started one (Blocker 2)", async () => {
    // Both areas' welcome modals pre-dismissed: useDismissals fetches once
    // on mount and this test never remounts the host (that's the point --
    // it persists across route navigations in the real app shell too).
    mockState = {
      dismissals: [
        { kind: "welcome_modal", ref_id: "welcome-constitution" },
        { kind: "welcome_modal", ref_id: "welcome-explorer" },
      ],
    };
    mockUsePathname.mockReturnValue("/ce");
    const { rerender } = render(
      <>
        <main data-tour-id="ce.versions">
          <div data-tour-id="ce.overview">overview</div>
          <div data-tour-id="ce.glossary">glossary</div>
          <div data-tour-id="ce.query">query</div>
          <div data-tour-id="ce.rules">rules</div>
        </main>
        <OnboardingHintsHost />
      </>,
    );
    await waitFor(() => screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(await screen.findByRole("button", { name: /learn more/i }));
    expect(await screen.findByText("1 of 4")).toBeInTheDocument();

    mockUsePathname.mockReturnValue("/explorer");
    rerender(
      <>
        <main>
          <div data-tour-id="ge.overlay.completeness-legend">legend</div>
          <div data-tour-id="ge.canvas">canvas</div>
          <div data-tour-id="ge.canvas.spotlight-control">spotlight</div>
        </main>
        <OnboardingHintsHost />
      </>,
    );
    await waitFor(() => screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(await screen.findByRole("button", { name: /learn more/i }));

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
  });
});
