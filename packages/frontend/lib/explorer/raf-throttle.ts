/** Collapses bursty calls (e.g. Cytoscape's `viewport` event during a pan or
 * zoom gesture) into at most one call per animation frame, using the
 * latest arguments -- so the mini-map never thrashes layout on every tick.
 * (rAF-based per the implementation hint; a lodash dependency isn't needed
 * for this.) */
export function rafThrottle<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void {
  let scheduled = false;
  let latestArgs: Args;

  return (...args: Args): void => {
    latestArgs = args;
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn(...latestArgs);
    });
  };
}
