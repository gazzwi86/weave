"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Popover from "@radix-ui/react-popover";

import { t } from "../../lib/onboarding/i18n";
import { anchorSelector, isTourShipped } from "../../lib/onboarding/tour-content";
import { ANCHORS } from "../../../shared/onboarding/anchors";
import { TOURS } from "../../../shared/onboarding/content/tours";
import type { Beacon as BeaconConfig } from "../../../shared/onboarding/content/schema";

export interface BeaconProps {
  beacon: BeaconConfig;
  onDismiss: () => void;
  onStartTour: (tourId: string) => void;
}

/** AC-008-01's "Learn more" target: the first shipped tour in the same area
 * as the beacon's anchor. No explicit config field ties a beacon to a tour
 * (TASK-003's schema doesn't carry one) -- area-matching is the simplest
 * derivation that stays dead-CTA-safe (skips if no shipped tour exists). */
function learnMoreTourId(beacon: BeaconConfig): string | null {
  const area = ANCHORS[beacon.anchorId].area;
  return TOURS.find((tour) => tour.area === area && isTourShipped(tour))?.tourId ?? null;
}

function warnUnmounted(beaconId: string): void {
  console.warn(`[onboarding] beacon "${beaconId}" target unmounted while open, hiding`);
}

interface AnchorState {
  present: boolean;
  rect: DOMRect | null;
}

const EMPTY_ANCHOR_STATE: AnchorState = { present: false, rect: null };

/** Anchor presence + position via useSyncExternalStore, not a raw
 * setState-in-effect -- the DOM (Popover's real anchor) is an external
 * system React doesn't own, and this is React's own blessed hook for
 * subscribing to one. Polls every 250ms (light; only re-renders on a
 * present/absent flip, via the cached-snapshot check) -- this single
 * subscription is also what detects AC-008-03's unmount case, no separate
 * watcher needed. */
function useAnchorState(anchorId: BeaconConfig["anchorId"]): AnchorState {
  const cacheRef = useRef<AnchorState>(EMPTY_ANCHOR_STATE);

  const getSnapshot = useCallback((): AnchorState => {
    const target = document.querySelector(anchorSelector(anchorId));
    const present = target !== null;
    if (cacheRef.current.present !== present) {
      cacheRef.current = { present, rect: target?.getBoundingClientRect() ?? null };
    }
    return cacheRef.current;
  }, [anchorId]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    onStoreChange(); // resync once the store is live, i.e. after mount/commit
    const id = window.setInterval(onStoreChange, 250);
    return () => window.clearInterval(id);
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_ANCHOR_STATE);
}

const DOT_CLASS =
  "fixed z-50 h-[var(--space-3)] w-[var(--space-3)] rounded-full border-0 bg-[var(--color-accent-primary)] " +
  "animate-pulse focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

const TOOLTIP_CLASS =
  "z-50 max-w-[280px] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] " +
  "p-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] shadow-[var(--shadow-panel)]";

interface TooltipContentProps {
  beacon: BeaconConfig;
  tourId: string | null;
  onLearnMore: () => void;
  onDismiss: () => void;
}

function TooltipContent({ beacon, tourId, onLearnMore, onDismiss }: TooltipContentProps) {
  return (
    <Popover.Content role="dialog" aria-label={t(beacon.bodyKey)} className={TOOLTIP_CLASS}>
      <p>{t(beacon.bodyKey)}</p>
      <div className="mt-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
        {tourId ? (
          <button type="button" onClick={onLearnMore} className="text-[var(--color-accent-primary)] underline">
            {t("onboarding.beacon.learn-more")}
          </button>
        ) : null}
        <button type="button" onClick={onDismiss} className="text-[var(--color-text-muted)]">
          {t("onboarding.beacon.dismiss")}
        </button>
      </div>
    </Popover.Content>
  );
}

/** ONB-TASK-008: pulsing beacon on a shipped complex-element anchor, Radix
 * Popover tooltip (ADR-001 scopes Driver.js to tours only). */
export function Beacon({ beacon, onDismiss, onStartTour }: BeaconProps) {
  const { present, rect } = useAnchorState(beacon.anchorId);
  const [open, setOpen] = useState(false);
  const wasOpenAndPresentRef = useRef(false);

  // AC-008-03: anchor unmounted while the tooltip was open -> warn once.
  // Hiding itself is just the `!present` early return below, no setState
  // needed here (only a ref write, which the set-state-in-effect lint rule
  // doesn't flag).
  useEffect(() => {
    if (!present && wasOpenAndPresentRef.current) {
      warnUnmounted(beacon.beaconId);
    }
    wasOpenAndPresentRef.current = open && present;
  }, [present, open, beacon.beaconId]);

  if (!present) return null;

  const tourId = learnMoreTourId(beacon);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={t("onboarding.beacon.hint")}
        className={DOT_CLASS}
        style={rect ? { top: rect.top - 4, left: rect.right - 4 } : undefined}
      />
      <Popover.Portal>
        <TooltipContent
          beacon={beacon}
          tourId={tourId}
          onLearnMore={() => {
            setOpen(false);
            if (tourId) onStartTour(tourId);
          }}
          onDismiss={() => {
            setOpen(false);
            onDismiss();
          }}
        />
      </Popover.Portal>
    </Popover.Root>
  );
}
