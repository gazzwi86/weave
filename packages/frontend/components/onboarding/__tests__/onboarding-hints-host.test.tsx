import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingHintsHost } from "../onboarding-hints-host";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

interface MockState {
  dismissals: Array<{ kind: string; ref_id: string }>;
}

let mockState: MockState;

function mockFetch(url: string): Promise<Response> {
  if (url === "/api/onboarding/state") {
    return Promise.resolve(new Response(JSON.stringify({ dismissals: mockState.dismissals })));
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
    mockUsePathname.mockReturnValue("/settings/members");
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
});
