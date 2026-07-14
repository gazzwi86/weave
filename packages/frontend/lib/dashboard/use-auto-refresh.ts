"use client";

import { useEffect, useRef } from "react";

import type { WidgetOut, WidgetStatus } from "@/components/dashboard/types";

/** One tick, not one timer per widget (Implementation Hints: "n timers is
 * drift and churn") -- polled every `TICK_MS`, each widget refreshes when
 * its own `fetched_at + refresh_interval_s` is due.
 */
export const AUTO_REFRESH_TICK_MS = 30_000;

export interface RefreshResult {
  status: WidgetStatus;
  fetched_at: string | null;
}

function isDue(widget: WidgetOut, now: number): boolean {
  if (widget.fetched_at === null) return true;
  const age = now - new Date(widget.fetched_at).getTime();
  return age >= widget.refresh_interval_s * 1000;
}

/** AC-3: pure so it's testable without a timer/DOM harness -- the hook
 * below is thin glue around this. */
export function widgetsDueForRefresh(widgets: WidgetOut[], now: number): string[] {
  return widgets.filter((widget) => isDue(widget, now)).map((widget) => widget.id);
}

/** AC-3/AC-4: visibility-gated auto-refresh loop. Never refreshes while
 * `document.visibilityState === "hidden"`; on becoming visible again,
 * immediately refreshes anything overdue instead of waiting for the next
 * tick.
 */
export function useAutoRefresh(
  widgets: WidgetOut[],
  fetchRefresh: (id: string) => Promise<RefreshResult>,
  onRefreshed: (id: string, result: RefreshResult) => void
): void {
  // Latest-value refs, kept in sync via effect (never mutated during
  // render) so `tick`'s listeners never need re-binding on every prop
  // change -- the interval/listener pair below is set up exactly once.
  const widgetsRef = useRef(widgets);
  const fetchRef = useRef(fetchRefresh);
  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    widgetsRef.current = widgets;
    fetchRef.current = fetchRefresh;
    onRefreshedRef.current = onRefreshed;
  }, [widgets, fetchRefresh, onRefreshed]);

  useEffect(() => {
    function tick(): void {
      if (document.visibilityState === "hidden") return;
      for (const id of widgetsDueForRefresh(widgetsRef.current, Date.now())) {
        fetchRef.current(id).then((result) => onRefreshedRef.current(id, result)).catch(() => {});
      }
    }

    const interval = setInterval(tick, AUTO_REFRESH_TICK_MS);
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") tick();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
