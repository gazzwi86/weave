import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RulesTour } from "../rules-tour";

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(),
}));

const { useSearchParams } = await import("next/navigation");

function mockTourParam(value: string | null): void {
  vi.mocked(useSearchParams).mockReturnValue({
    get: (key: string) => (key === "tour" ? value : null),
  } as unknown as ReturnType<typeof useSearchParams>);
}

// Anchors this tour targets, same DOM stand-in pattern as explorer-tour.test.tsx.
function AnchorHarness() {
  return (
    <main>
      <div data-tour-id="ce.rules.shape-list">Shape list</div>
      <div data-tour-id="ce.rules.violation-report">Violation report</div>
    </main>
  );
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

// ONB-V1-TASK-004 AC-004-01/05: `tour.ce.rules-policies` host on the CE
// rules page -- deep-link-only start (no proactive gate here; role
// tailoring for the proactive offer lives in availableTours/help-launcher),
// matching AC-004-05's requirement that Business/Admin also reach this tour
// via the help launcher without a dead CTA.
describe("RulesTour (AC-004-01/05)", () => {
  beforeEach(stubDomAndFetch);

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("auto-starts from ?tour=rules-policies", async () => {
    mockTourParam("rules-policies");

    render(
      <>
        <AnchorHarness />
        <RulesTour />
      </>,
    );

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
  });

  it("does not start without the ?tour= query param", async () => {
    mockTourParam(null);

    render(
      <>
        <AnchorHarness />
        <RulesTour />
      </>,
    );

    expect(screen.queryByText("1 of 2")).not.toBeInTheDocument();
  });

  // Regression for the pending-state gap: page.tsx's pending branch (no
  // report run yet) must carry both CE anchor ids too, or a first-time
  // visit gets zero tour steps.
  it("auto-starts against the page's pending-state markup (no report run yet)", async () => {
    mockTourParam("rules-policies");

    render(
      <>
        <main>
          <div data-tour-id="ce.rules.shape-list">
            <p data-tour-id="ce.rules.violation-report">No validation run yet for the current draft.</p>
          </div>
        </main>
        <RulesTour />
      </>,
    );

    expect(await screen.findByText("1 of 2")).toBeInTheDocument();
  });

  it("has no axe violations while the rules-policies step is highlighted", async () => {
    mockTourParam("rules-policies");

    render(
      <>
        <AnchorHarness />
        <RulesTour />
      </>,
    );
    await screen.findByText("1 of 2");

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
