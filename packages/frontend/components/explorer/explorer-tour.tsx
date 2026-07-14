"use client";

import { useEffect, useRef } from "react";

import { useOnboardingPath } from "@/app/settings/onboarding-path/use-onboarding-path";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { shouldAutoStartCompletenessTour } from "@/lib/onboarding/explorer-tour";
import { useTourEngine, type TourProgress } from "@/lib/onboarding/use-tour-engine";

import type { Tour } from "../../../shared/onboarding/content/schema";
import { TOURS } from "../../../shared/onboarding/content/tours";

function requireCompletenessTour(): Tour {
  const tour = TOURS.find((t) => t.tourId === "tour.ge.completeness-map");
  if (!tour) throw new Error("tour.ge.completeness-map missing from TOURS -- TASK-001 config regressed");
  return tour;
}

const COMPLETENESS_TOUR = requireCompletenessTour();

export interface ExplorerTourProps {
  /** `?tour=` search param from the server page -- the help-launcher's deep
   * link into this tour (AC-002-01). */
  tourParam: string | null;
}

function persistProgress(progress: TourProgress): void {
  void fetch(`/api/onboarding/tours/${COMPLETENESS_TOUR.tourId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_completed_step: progress.lastCompletedStep,
      completed: progress.completed,
      skipped: progress.skipped,
    }),
  });
}

/** ONB-V1-TASK-002: wires `tour.ge.completeness-map` (m2-delta.md §3) into
 * the Explorer area via m1/TASK-007's TourOverlay/useTourEngine -- no new
 * tour machinery, just the area-specific gating + persistence glue. */
export function ExplorerTour({ tourParam }: ExplorerTourProps) {
  const { path } = useOnboardingPath();
  const engine = useTourEngine({ tour: COMPLETENESS_TOUR, onPersist: persistProgress });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!shouldAutoStartCompletenessTour(tourParam, path?.role_path ?? null, COMPLETENESS_TOUR)) return;
    started.current = true;
    engine.start();
  }, [tourParam, path, engine]);

  return <TourOverlay engine={engine} />;
}
