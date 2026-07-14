"use client";

import { useCallback, useMemo, useState } from "react";

import { domHasAnchor, renderableSteps } from "./tour-content";
import type { AnchorId } from "../../../shared/onboarding/anchors";
import type { Tour, TourStep } from "../../../shared/onboarding/content/schema";

export interface TourProgress {
  lastCompletedStep: number;
  completed: boolean;
  skipped: boolean;
}

export type TourStatus = "idle" | "active" | "done";

export interface UseTourEngineOptions {
  tour: Tour;
  /** Persists a progress write -- caller owns the network call (ONB-TASK-001
   * `PUT /api/onboarding/tours/{tour_id}/progress`). Called only on step
   * completion, skip, or finish -- never on every render (implementation
   * hint: debounce by only writing at these points). */
  onPersist: (progress: TourProgress) => void;
  /** Test seam; defaults to the real DOM check. */
  hasAnchor?: (anchorId: AnchorId) => boolean;
}

export interface UseTourEngineResult {
  status: TourStatus;
  /** Steps after anchor-presence filtering (AC-007-04) -- the "N of total"
   * indicator counts this, never the raw config step count. */
  steps: TourStep[];
  activeIndex: number;
  activeStep: TourStep | undefined;
  totalSteps: number;
  /** WHERE this tour is unavailable, `steps` is empty after `start()`. */
  start: () => void;
  /** AC-007-02: resumes at the last-completed-step, server-persisted value. */
  resume: (progress: TourProgress) => void;
  next: () => void;
  back: () => void;
  /** AC-007-02: "Skip tour" / Escape -- exits without deleting progress. */
  skip: () => void;
}

/** ONB-TASK-007: the owned tour state machine (ADR-001) -- Driver.js is a
 * dumb per-step renderer driven by this hook; it never holds tour state. */
export function useTourEngine({ tour, onPersist, hasAnchor = domHasAnchor }: UseTourEngineOptions): UseTourEngineResult {
  const [status, setStatus] = useState<TourStatus>("idle");
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const beginAt = useCallback(
    (index: number) => {
      const computed = renderableSteps(tour, hasAnchor);
      setSteps(computed);
      if (computed.length === 0) {
        setStatus("done");
        setActiveIndex(0);
        return;
      }
      setStatus("active");
      setActiveIndex(Math.min(Math.max(index, 0), computed.length - 1));
    },
    [tour, hasAnchor],
  );

  const start = useCallback(() => beginAt(0), [beginAt]);

  const resume = useCallback(
    (progress: TourProgress) => beginAt(progress.lastCompletedStep), // AC-007-02
    [beginAt],
  );

  const next = useCallback(() => {
    setActiveIndex((current) => {
      const isLast = current >= steps.length - 1;
      if (isLast) {
        setStatus("done");
        onPersist({ lastCompletedStep: current, completed: true, skipped: false });
        return current;
      }
      onPersist({ lastCompletedStep: current, completed: false, skipped: false });
      return current + 1;
    });
  }, [steps.length, onPersist]);

  const back = useCallback(() => {
    setActiveIndex((current) => Math.max(0, current - 1));
  }, []);

  const skip = useCallback(() => {
    setStatus("done"); // AC-007-02: exits without deleting progress.
    onPersist({ lastCompletedStep: activeIndex, completed: false, skipped: true });
  }, [activeIndex, onPersist]);

  const activeStep = useMemo(() => steps[activeIndex], [steps, activeIndex]);

  return { status, steps, activeIndex, activeStep, totalSteps: steps.length, start, resume, next, back, skip };
}
