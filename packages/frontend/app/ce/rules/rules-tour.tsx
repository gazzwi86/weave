"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { TourOverlay } from "@/components/onboarding/tour-overlay";
import { shouldAutoStartQueryTour } from "@/lib/onboarding/tour-deep-link";
import { useTourEngine, type TourProgress } from "@/lib/onboarding/use-tour-engine";

import { TOURS } from "../../../../shared/onboarding/content/tours";

const RULES_POLICIES_TOUR_QUERY_VALUE = "rules-policies";

function requireRulesPoliciesTour() {
  const tour = TOURS.find((t) => t.tourId === "tour.ce.rules-policies");
  if (!tour) throw new Error("tour.ce.rules-policies missing from TOURS -- TASK-001 config regressed");
  return tour;
}

const RULES_POLICIES_TOUR = requireRulesPoliciesTour();

function persistProgress(progress: TourProgress): void {
  void fetch(`/api/onboarding/tours/${RULES_POLICIES_TOUR.tourId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_completed_step: progress.lastCompletedStep,
      completed: progress.completed,
      skipped: progress.skipped,
    }),
  });
}

/** ONB-V1-TASK-004 AC-004-01/05: wires `tour.ce.rules-policies` into the CE
 * rules page. Deep-link-only (help-launcher's `?tour=rules-policies`,
 * AC-004-05) -- no proactive auto-open on page load, so Compliance/Technical
 * are offered it via availableTours()'s proactive-offer path while
 * Business/Admin still reach the same tour through the launcher link
 * without a dead CTA. */
export function RulesTour() {
  const searchParams = useSearchParams();
  const tourParam = searchParams?.get("tour") ?? null;
  const engine = useTourEngine({ tour: RULES_POLICIES_TOUR, onPersist: persistProgress });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (!shouldAutoStartQueryTour(tourParam, RULES_POLICIES_TOUR_QUERY_VALUE, RULES_POLICIES_TOUR)) return;
    started.current = true;
    engine.start();
  }, [tourParam, engine]);

  return <TourOverlay engine={engine} />;
}
