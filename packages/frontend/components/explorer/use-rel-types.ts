"use client";

import { useEffect, useState } from "react";

import { fetchRelTypes as defaultFetchRelTypes } from "@/lib/explorer/fetch-graph";
import type { RelKind } from "@/lib/explorer/types";

/** TASK-023 AC-6: the draw-edge picker's relationship-type palette --
 * mirrors useCanvasLegend's boot-time fetch shape, but reads relTypes off
 * the same /api/proxy/node-kinds response (no second CE-READ-1 call). */
export function useRelTypes(fetchRelTypes: () => Promise<RelKind[]> = defaultFetchRelTypes): RelKind[] {
  const [relTypes, setRelTypes] = useState<RelKind[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchRelTypes().then((types) => {
      if (!cancelled) setRelTypes(types);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchRelTypes]);
  return relTypes;
}
