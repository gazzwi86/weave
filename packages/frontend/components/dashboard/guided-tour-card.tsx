"use client";

import { useMemo } from "react";

import { HelpCard } from "@/components/organisms/HelpPanel";
import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { useTourEngine, type TourProgress } from "@/lib/onboarding/use-tour-engine";

import { TOURS } from "../../../shared/onboarding/content/tours";

function findCeOverviewTour() {
  const tour = TOURS.find((entry) => entry.tourId === "ce-overview");
  if (!tour) throw new Error("ce-overview missing from TOURS -- Home 'Get going' card regressed");
  return tour;
}

function persistCeOverviewProgress(progress: TourProgress): void {
  void fetch("/api/onboarding/tours/ce-overview/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_completed_step: progress.lastCompletedStep,
      completed: progress.completed,
      skipped: progress.skipped,
    }),
  });
}

/** v5 Home "Get going" -- Guided tour card. ponytail: same start-tour wiring
 * as `components/shell/help-launcher.tsx`'s card (useTourEngine +
 * TourOverlay, own engine instance) rather than a shared hook -- a second
 * call site isn't worth extracting yet (YAGNI); pull it out if a third
 * appears. */
export function GuidedTourCard() {
  const tour = useMemo(() => findCeOverviewTour(), []);
  const engine = useTourEngine({ tour, onPersist: persistCeOverviewProgress });

  return (
    <>
      <HelpCard
        card={{
          icon: "play",
          title: "Guided tour",
          subtitle: "3 minutes — canvas, ask bar, publishing",
          onClick: engine.start,
        }}
      />
      <TourOverlay engine={engine} />
    </>
  );
}
