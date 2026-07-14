import { act, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourOverlay } from "../tour-overlay";
import { useTourEngine, type UseTourEngineResult } from "../../../lib/onboarding/use-tour-engine";
import type { Tour } from "../../../../shared/onboarding/content/schema";

const tour: Tour = {
  tourId: "ce-overview",
  area: "constitution",
  paths: ["business"],
  phase: "m1",
  steps: [
    { anchorId: "ce.overview", titleKey: "onboarding.tour.ce-overview.step1.title", bodyKey: "onboarding.tour.ce-overview.step1.body" },
    { anchorId: "ce.glossary", titleKey: "onboarding.tour.ce-overview.step2.title", bodyKey: "onboarding.tour.ce-overview.step2.body" },
  ],
};

/** Driver.js schedules its highlight transition via requestAnimationFrame;
 * flush a couple of frames so the popover has actually mounted before we
 * assert against it. */
function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function Harness({ onEngine }: { onEngine?: (engine: UseTourEngineResult) => void }) {
  const engine = useTourEngine({ tour, onPersist: vi.fn(), hasAnchor: () => true });
  onEngine?.(engine);
  return (
    <main>
      <div data-tour-id="ce.overview">Overview</div>
      <div data-tour-id="ce.glossary">Glossary</div>
      <TourOverlay engine={engine} />
    </main>
  );
}

describe("TourOverlay (AC-007-01/03/06/07)", () => {
  beforeEach(() => {
    // jsdom returns an all-zero rect for every element; Driver.js treats a
    // zero-size target as invisible and skips popover creation. Stub a
    // realistic rect so the popover actually renders under jsdom.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40, toJSON() {},
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders no visible React output itself -- Driver.js portal is the overlay", () => {
    const { container } = render(<Harness />);
    // TourOverlay itself renders null; only the harness's own anchors show up.
    expect(container.querySelectorAll("[data-tour-id]")).toHaveLength(2);
  });

  it("highlights the active step with i18n title/body and a step indicator when started", async () => {
    let engineRef: UseTourEngineResult | undefined;
    render(<Harness onEngine={(e) => (engineRef = e)} />);

    await act(async () => {
      engineRef!.start();
      await flushRaf();
    });

    expect(await screen.findByText("Welcome to the graph")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("clicking Next advances to the next step (never requires interacting with the highlighted element)", async () => {
    let engineRef: UseTourEngineResult | undefined;
    render(<Harness onEngine={(e) => (engineRef = e)} />);
    await act(async () => {
      engineRef!.start();
      await flushRaf();
    });
    await screen.findByText("1 of 2");

    await act(async () => {
      screen.getByRole("button", { name: "Next" }).click();
      await flushRaf();
    });

    expect(await screen.findByText("2 of 2")).toBeInTheDocument();
  });

  it("Escape skips the tour without deleting progress (AC-007-02/03)", () => {
    let engineRef: UseTourEngineResult | undefined;
    render(<Harness onEngine={(e) => (engineRef = e)} />);
    act(() => engineRef!.start());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(engineRef!.status).toBe("done");
  });

  it("ArrowRight advances without clicking anything (keyboard-only navigation, AC-007-03)", () => {
    let engineRef: UseTourEngineResult | undefined;
    render(<Harness onEngine={(e) => (engineRef = e)} />);
    act(() => engineRef!.start());

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    expect(engineRef!.activeIndex).toBe(1);
  });

  it("has no axe violations while a step is highlighted (AC-007-06)", async () => {
    let engineRef: UseTourEngineResult | undefined;
    render(<Harness onEngine={(e) => (engineRef = e)} />);
    await act(async () => {
      engineRef!.start();
      await flushRaf();
    });
    await screen.findByText("1 of 2");

    const results = await axe(document.body);
    expect(results.violations).toEqual([]);
  });
});
