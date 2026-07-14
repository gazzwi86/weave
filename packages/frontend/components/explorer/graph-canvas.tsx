"use client";

import { useMemo, useState } from "react";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import { computeSlice } from "@/lib/explorer/compute-slice";
import { fetchGraph as defaultFetchGraph } from "@/lib/explorer/fetch-graph";

import { EmptyState } from "./empty-state";
import { ExplorerCanvas } from "./explorer-canvas";

/** ge-canvas-1.md rule 8: hop depth for the `filterByIri` slice. ponytail:
 * fixed constant (adjacency-only traversal, the brief's soft-dependency
 * escape hatch) -- swap for TASK-028's closure/depth-cap config when it
 * lands, same computeSlice output shape either way. */
const SLICE_HOP_DEPTH = 1;

/** GE-CANVAS-1 M2 pin (contracts.md §GE-CANVAS-1; normative surface at
 * docs/specs/weave/engines/constitution-engine/tech-spec/ge-canvas-1.md).
 * LOCKED -- do not add props here without a contract amendment. */
export type GraphCanvasProps = {
  source: string;
  filterByIri?: string;
  mode: "force";
  readonly: boolean;
  version?: string;
};

/** GraphCanvas has no `role` prop (the pin doesn't carry one) -- unlike the
 * Explorer shell, GE-CANVAS-1's UX-level edit gate is `readonly` alone
 * (rules 4/5/9). This sentinel just satisfies ExplorerInteractions'
 * existing role-based `canEditCanvas` UX check when editing IS permitted;
 * CE-WRITE-1 independently authorises server-side regardless (ADR-019) --
 * see can-edit-canvas.ts's own "UX layer only" note. */
const EMBEDDED_EDITOR_ROLE = "business_analyst_sme";

function unsupportedModeMessage(mode: string): string {
  return `GE-CANVAS-1 M2 supports mode:"force" only (${mode} is post-v1) — see ge-canvas-1.md`;
}

/** ge-canvas-1.md rule 4: a pinned `version` forces readonly regardless of
 * the `readonly` prop -- published versions are immutable. */
export function computeEffectiveReadonly(readonly: boolean, version: string | undefined): boolean {
  return readonly || version !== undefined;
}

/** GE-CANVAS-1 (contracts.md; ge-canvas-1.md) -- the embeddable force-mode
 * canvas Build M2 mounts. A thin wrapper over ExplorerCanvas (rules 1/5/7/9
 * are inherited by construction: same load hook, same edit controller,
 * same layout endpoints -- no second write path, no Build-local layout
 * store); this file only adds mode validation (rule 3), the readonly/
 * version override (rules 4/9), and the filterByIri slice (rules 2/8). */
export function GraphCanvas({ source, filterByIri, mode, readonly, version }: GraphCanvasProps) {
  if (mode !== "force") {
    throw new Error(unsupportedModeMessage(mode));
  }

  const effectiveReadonly = computeEffectiveReadonly(readonly, version);
  const [noSliceMatch, setNoSliceMatch] = useState(false);

  // rule 7: layout persists under graph_id = source, not a Build-local store.
  const config = useMemo(() => ({ ...DEFAULT_EXPLORER_CONFIG, layoutGraphId: source }), [source]);

  const fetchGraph = useMemo(
    () => async (timeoutMs: number) => {
      const elements = await defaultFetchGraph(timeoutMs, version ?? "latest");
      if (!filterByIri) {
        setNoSliceMatch(false);
        return elements;
      }
      const slice = computeSlice(elements, filterByIri, SLICE_HOP_DEPTH);
      setNoSliceMatch(!slice.matched);
      return slice.elements;
    },
    [version, filterByIri]
  );

  if (noSliceMatch) {
    // rule 2: no match is a valid empty state, never an error.
    return <EmptyState message="No results for that filter." onRetry={() => setNoSliceMatch(false)} />;
  }

  return (
    <ExplorerCanvas
      options={{ config, fetchGraph }}
      role={effectiveReadonly ? null : EMBEDDED_EDITOR_ROLE}
    />
  );
}
