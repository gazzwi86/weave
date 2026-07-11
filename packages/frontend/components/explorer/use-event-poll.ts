"use client";

import { useEffect, useRef } from "react";

import { fetchEvents as defaultFetchEvents, type EventsPollResult } from "@/lib/explorer/events-client";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";

export interface UseEventPollOptions {
  adapter: RendererAdapter | null;
  /** TASK-026 Design Decision: one canvas-mode subscription -- caller
   * passes `mode === "draft" && !readOnly` (or equivalent), this hook
   * never keeps a second mode flag of its own. */
  active: boolean;
  intervalMs?: number;
  /** Paginated loader for just the changed entity IRIs. */
  fetchDelta: (entityIris: string[]) => Promise<CytoscapeElement[]>;
  /** AC-7: 410 (cursor aged out) re-baseline -- full CE-READ-1 reload. */
  reloadGraph: () => Promise<void>;
  fetchEvents?: (sinceSeq: number) => Promise<EventsPollResult>;
  /** Read live at poll time so it reflects a drag in progress right now. */
  unsavedDragIds: () => string[];
}

const DEFAULT_POLL_INTERVAL_MS = 30_000;

/** TASK-026 AC-7: while the draft canvas is open, polls the CE-EVENT-1 beta
 * seq feed and merges changed elements in place without discarding an
 * unsaved drag; a 410 re-baselines via a full CE-READ-1 reload; polling is
 * fully paused (no timer at all) while `active` is false. */
export function useEventPoll({
  adapter,
  active,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  fetchDelta,
  reloadGraph,
  fetchEvents = defaultFetchEvents,
  unsavedDragIds,
}: UseEventPollOptions): void {
  const cursorRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !adapter) return undefined;
    const currentAdapter = adapter;
    let cancelled = false;

    async function rebaseline(): Promise<void> {
      const result = await fetchEvents(0);
      if (!cancelled && result.status === 200) cursorRef.current = result.latest_seq;
    }

    async function tick(): Promise<void> {
      if (cancelled || cursorRef.current === null) return;
      const result = await fetchEvents(cursorRef.current);
      if (cancelled) return;
      if (result.status === 410) {
        await reloadGraph();
        if (!cancelled) await rebaseline();
        return;
      }
      cursorRef.current = result.latest_seq;
      const changedIris = [...new Set(result.events.map((event) => event.entity_iri))];
      if (changedIris.length === 0) return;
      const delta = await fetchDelta(changedIris);
      if (!cancelled) currentAdapter.mergeInPlace(delta, unsavedDragIds());
    }

    rebaseline();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, adapter, intervalMs, fetchDelta, reloadGraph, fetchEvents, unsavedDragIds]);
}
