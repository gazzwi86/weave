"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useOnboardingPath } from "@/app/settings/onboarding-path/use-onboarding-path";

import { Beacon } from "./beacon";
import { WelcomeModal } from "./welcome-modal";
import { TourOverlay } from "./tour-overlay";
import { useDismissals } from "../../lib/onboarding/use-dismissals";
import { useTourEngine, type TourProgress } from "../../lib/onboarding/use-tour-engine";
import { isAreaShipped } from "../../lib/onboarding/dismissals";
import { areaForPathname } from "../../../shared/onboarding/content/contextual-help";
import { ANCHORS } from "../../../shared/onboarding/anchors";
import { BEACONS } from "../../../shared/onboarding/content/beacons";
import { WELCOME_MODALS } from "../../../shared/onboarding/content/modals";
import { TOURS } from "../../../shared/onboarding/content/tours";
import type { Tour } from "../../../shared/onboarding/content/schema";

// Fallback so useTourEngine (an unconditional hook) always has a real Tour
// to call even when the requested tourId doesn't resolve -- start() is never
// invoked against it (guarded below), it just satisfies the hook's contract.
const NULL_TOUR: Tour = { tourId: "__none__", area: "", paths: ["business"], phase: "m1", steps: [] };

function persistTourProgress(tourId: string, progress: TourProgress): void {
  void fetch(`/api/onboarding/tours/${tourId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_completed_step: progress.lastCompletedStep,
      completed: progress.completed,
      skipped: progress.skipped,
    }),
  });
}

interface ActiveTourProps {
  tourId: string;
}

/** Drives one tour to completion via the shared engine/overlay (TASK-007) --
 * a "Learn more" beacon click or a modal's "tour" CTA both funnel here. */
function ActiveTour({ tourId }: ActiveTourProps) {
  const tour = TOURS.find((candidate) => candidate.tourId === tourId);
  const engine = useTourEngine({
    tour: tour ?? NULL_TOUR,
    onPersist: (progress) => persistTourProgress(tourId, progress),
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !tour) return;
    started.current = true;
    engine.start();
  }, [tour, engine]);

  if (!tour) return null;
  return <TourOverlay engine={engine} />;
}

/** ONB-TASK-008: per-screen host mounted once in the app shell. Reads the
 * dismissal set from ONE bootstrap fetch (useDismissals) and the active
 * area/role path, then renders only the beacons/modals that belong here --
 * no per-beacon network calls (implementation hint). */
export function OnboardingHintsHost() {
  const pathname = usePathname();
  const area = areaForPathname(pathname ?? null);
  const { path } = useOnboardingPath();
  const { loading, isDismissed, dismiss } = useDismissals();
  const [activeTourId, setActiveTourId] = useState<string | null>(null);

  // AC-008-06: a feature-flagged-off area (no shipped anchor at all) renders
  // neither beacons nor modals.
  if (!area || !isAreaShipped(area) || loading || !path) return null;

  const rolePath = path.role_path;
  const startTour = (tourId: string) => setActiveTourId(tourId);

  const areaBeacons = BEACONS.filter(
    (beacon) =>
      ANCHORS[beacon.anchorId].area === area &&
      ANCHORS[beacon.anchorId].shipped &&
      beacon.paths.includes(rolePath) &&
      !isDismissed("beacon", beacon.beaconId),
  );

  // AC-008-04: first-visit only -- "no dismissal row" is the whole check, so
  // at most the one not-yet-dismissed modal for this area ever shows.
  const areaModal = WELCOME_MODALS.find(
    (modal) => modal.area === area && !isDismissed("welcome_modal", modal.modalId),
  );

  return (
    <>
      {areaBeacons.map((beacon) => (
        <Beacon
          key={beacon.beaconId}
          beacon={beacon}
          onDismiss={() => void dismiss("beacon", beacon.beaconId)}
          onStartTour={startTour}
        />
      ))}
      {areaModal ? (
        <WelcomeModal
          key={areaModal.modalId}
          modal={areaModal}
          onDismiss={() => void dismiss("welcome_modal", areaModal.modalId)}
          onStartTour={startTour}
        />
      ) : null}
      {activeTourId ? <ActiveTour tourId={activeTourId} /> : null}
    </>
  );
}
