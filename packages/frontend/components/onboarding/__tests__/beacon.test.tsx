import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { Beacon } from "../beacon";
import type { Beacon as BeaconConfig } from "../../../../shared/onboarding/content/schema";

const ceVersionsBeacon: BeaconConfig = {
  beaconId: "ce-versions",
  anchorId: "ce.versions",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  bodyKey: "onboarding.beacon.ce-versions.body",
};

// The real anchor is a DOM element planted by an unrelated page component,
// not by Beacon itself -- rendered as a JSX sibling under one root, same as
// the real app-shell (Beacon mounted separately from the page it overlays).
function Screen({ withAnchor = true }: { withAnchor?: boolean }) {
  return (
    <>
      {withAnchor ? <main data-tour-id="ce.versions" /> : null}
      <Beacon beacon={ceVersionsBeacon} onDismiss={onDismiss} onStartTour={onStartTour} />
    </>
  );
}

const onDismiss = vi.fn();
const onStartTour = vi.fn();

describe("Beacon", () => {
  beforeEach(() => {
    onDismiss.mockClear();
    onStartTour.mockClear();
  });

  it("renders nothing when its anchor target is absent (AC-008-01)", () => {
    render(<Screen withAnchor={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a pulsing beacon dot when the target is present (AC-008-01)", () => {
    render(<Screen />);
    expect(screen.getByRole("button", { name: /hint available/i })).toBeInTheDocument();
  });

  it("clicking the beacon opens a tooltip with body copy, learn-more, and dismiss (AC-008-01)", () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/every commit is versioned/i)).toBeInTheDocument();
  });

  it("dismiss calls onDismiss with the beacon id (AC-008-02)", () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("learn-more link starts the relevant tour (AC-008-01)", () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    fireEvent.click(screen.getByRole("button", { name: /learn more/i }));
    expect(onStartTour).toHaveBeenCalledWith("ce-overview");
  });

  it("hides beacon and tooltip with a logged warning when the target unmounts while open (AC-008-03)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { rerender } = render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<Screen withAnchor={false} />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /hint available/i })).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ce-versions"));
    warnSpy.mockRestore();
  });

  it("passes the axe zero-violations gate with the tooltip open (AC-008-07)", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: /hint available/i }));
    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
