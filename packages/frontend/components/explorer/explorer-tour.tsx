"use client";

import { useEffect, useRef } from "react";

import { useOnboardingPath } from "@/app/settings/onboarding-path/use-onboarding-path";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { shouldAutoStartCompletenessTour } from "@/lib/onboarding/explorer-tour";
import { shouldAutoStartQueryTour } from "@/lib/onboarding/tour-deep-link";
import { useTourEngine, type TourProgress } from "@/lib/onboarding/use-tour-engine";

import type { Tour } from "../../../shared/onboarding/content/schema";
import { TOURS } from "../../../shared/onboarding/content/tours";

function requireTour(tourId: string): Tour {
  const tour = TOURS.find((t) => t.tourId === tourId);
  if (!tour) throw new Error(`${tourId} missing from TOURS -- TASK-001 config regressed`);
  return tour;
}

const COMPLETENESS_TOUR = requireTour("tour.ge.completeness-map");
// ONB-V1-TASK-004 AC-004-01: second tour on the same Explorer host, gated
// independently by its own `?tour=trust-mechanics` deep link (help-launcher
// entry point) -- paths=all 4, so no role-path gate needed on start.
const TRUST_MECHANICS_TOUR = requireTour("tour.ge.trust-mechanics");
const TRUST_MECHANICS_TOUR_QUERY_VALUE = "trust-mechanics";

export interface ExplorerTourProps {
  /** `?tour=` search param from the server page -- the help-launcher's deep
   * link into this tour (AC-002-01). */
  tourParam: string | null;
}

function persistProgress(tour: Tour) {
  return (progress: TourProgress): void => {
    void fetch(`/api/onboarding/tours/${tour.tourId}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_completed_step: progress.lastCompletedStep,
        completed: progress.completed,
        skipped: progress.skipped,
      }),
    });
  };
}

/** ONB-V1-TASK-002: wires `tour.ge.completeness-map` (m2-delta.md §3) into
 * the Explorer area via m1/TASK-007's TourOverlay/useTourEngine -- no new
 * tour machinery, just the area-specific gating + persistence glue.
 *
 * ONB-V1-TASK-004 AC-004-01/04: a second, independently-gated tour engine
 * (`tour.ge.trust-mechanics`) shares this host -- only one of the two ever
 * has renderable steps at a time since each only starts off its own
 * distinct `?tour=` value, so mounting both TourOverlays is safe. */
export function ExplorerTour({ tourParam }: ExplorerTourProps) {
  const { path } = useOnboardingPath();
  const completenessEngine = useTourEngine({ tour: COMPLETENESS_TOUR, onPersist: persistProgress(COMPLETENESS_TOUR) });
  const trustEngine = useTourEngine({ tour: TRUST_MECHANICS_TOUR, onPersist: persistProgress(TRUST_MECHANICS_TOUR) });
  // Keyed by tourParam, not a bare boolean: Next.js doesn't remount this
  // component on a query-only navigation, so a bare `started` ref would
  // permanently block a second deep-link (e.g. completeness-map ->
  // trust-mechanics via the help launcher) from ever starting.
  const started = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (started.current === tourParam) return;
    if (shouldAutoStartCompletenessTour(tourParam, path?.role_path ?? null, COMPLETENESS_TOUR)) {
      started.current = tourParam;
      completenessEngine.start();
    } else if (shouldAutoStartQueryTour(tourParam, TRUST_MECHANICS_TOUR_QUERY_VALUE, TRUST_MECHANICS_TOUR)) {
      started.current = tourParam;
      trustEngine.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- engine identities are new every render; gate on the inputs that actually change.
  }, [tourParam, path?.role_path]);

  return (
    <>
      <TourOverlay engine={completenessEngine} />
      <TourOverlay engine={trustEngine} />
    </>
  );
}
