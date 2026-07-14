import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorerTour } from "../explorer-tour";

vi.mock("@/app/settings/onboarding-path/use-onboarding-path", () => ({
  useOnboardingPath: vi.fn(),
}));

const { useOnboardingPath } = await import("@/app/settings/onboarding-path/use-onboarding-path");

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// Anchors this tour targets -- same DOM stand-ins the m1 TourOverlay tests
// use, since Driver.js needs a non-zero-size target in jsdom.
function AnchorHarness() {
  return (
    <main>
      <div data-tour-id="ge.overlay.controls">Overlay controls</div>
      <div data-tour-id="ge.overlay.completeness-legend">Completeness legend</div>
    </main>
  );
}

function mockResolvedBusinessPath(): void {
  vi.mocked(useOnboardingPath).mockReturnValue({
    path: { role_path: "business", path_variant: "default", path_chosen_manually: false, needs_choice: false },
    loadError: false,
    changePath: vi.fn(),
  });
}

function stubDomAndFetch(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    right: 100,
    bottom: 40,
    toJSON: () => ({}),
  } as DOMRect);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
}

describe("ExplorerTour (AC-002-01/04)", () => {
  beforeEach(stubDomAndFetch);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("auto-starts the tour from ?tour=completeness-map once the role path resolves (AC-002-01)", async () => {
    mockResolvedBusinessPath();

    render(
      <>
        <AnchorHarness />
        <ExplorerTour tourParam="completeness-map" />
      </>,
    );

    await flushRaf();

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
  });

  it("does not start without the ?tour= query param", async () => {
    mockResolvedBusinessPath();

    render(
      <>
        <AnchorHarness />
        <ExplorerTour tourParam={null} />
      </>,
    );

    await flushRaf();

    expect(screen.queryByText("1 of 2")).not.toBeInTheDocument();
  });

  it("has no axe violations while the completeness-map tour step is highlighted (AC-002-05)", async () => {
    mockResolvedBusinessPath();

    render(
      <>
        <AnchorHarness />
        <ExplorerTour tourParam="completeness-map" />
      </>,
    );
    await flushRaf();
    await screen.findByText("1 of 2");

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
