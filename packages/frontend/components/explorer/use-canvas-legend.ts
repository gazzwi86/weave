"use client";

import { useEffect, useState } from "react";

import { fetchPalette as defaultFetchPalette } from "@/lib/explorer/fetch-graph";
import type { NodeKind } from "@/lib/explorer/types";

export interface UseCanvasLegendResult {
  palette: NodeKind[];
  loading: boolean;
}

/** D-6: legend fetches the BPMO kind palette independently of the canvas
 * load (own loading state), so it renders correctly even if mounted before
 * the canvas has finished its own fetchPalette() call. */
export function useCanvasLegend(fetchPalette: () => Promise<NodeKind[]> = defaultFetchPalette): UseCanvasLegendResult {
  const [palette, setPalette] = useState<NodeKind[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPalette().then((kinds) => {
      if (cancelled) return;
      setPalette(kinds);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPalette]);

  return { palette, loading };
}
