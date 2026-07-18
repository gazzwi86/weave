"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

import { buildDiffExport } from "@/lib/explorer/diff/build-diff-export";
import { groupTriples } from "@/lib/explorer/diff/group-triples";
import { fetchGraph as defaultFetchGraph } from "@/lib/explorer/fetch-graph";
import { fetchOntologyTypes as defaultFetchOntologyTypes } from "@/lib/explorer/fetch-ontology-types";
import { createDiffOverlay } from "@/lib/explorer/overlays/diff-overlay";
import type { OverlayEngine } from "@/lib/explorer/overlay-engine";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { CytoscapeElement } from "@/lib/explorer/types";
import { fetchDiff as defaultFetchDiff } from "@/lib/explorer/versions/fetch-diff";
import { fetchVersions as defaultFetchVersions } from "@/lib/explorer/versions/fetch-versions";
import type { VersionEntry } from "@/lib/explorer/versions/types";

import { useVersionMode } from "./use-version-mode";

const DIFF_GLYPHS = { added: "+", removed: "−", modified: "~" };
const FETCH_TIMEOUT_MS = 15_000;

export interface UseVersionsPanelOptions {
  adapter: RendererAdapter | null;
  engine: OverlayEngine;
  fetchGraph?: (timeoutMs: number, version?: string) => Promise<CytoscapeElement[]>;
  fetchVersions?: typeof defaultFetchVersions;
  fetchDiff?: typeof defaultFetchDiff;
  fetchOntologyTypes?: typeof defaultFetchOntologyTypes;
}

export interface UseVersionsPanelResult {
  versions: VersionEntry[];
  listError: boolean;
  readOnly: boolean;
  pinnedIri: string | null;
  loadError: string | null;
  compareFrom: string | null;
  compareTo: string | null;
  diffNote: string | null;
  diffError: boolean;
  selectVersion(iri: string): void;
  selectForCompare(iri: string): void;
  clearCompare(): void;
  exportDiff(): void;
  returnToDraft(): void;
}

// TASK-022 AC-3: a triple's predicate counts as an edge iff CE-READ-1's
// ontology types list it as a relationship path (ADR-002: CE-DIFF-1 returns
// flat triples only, grouping into node vs. edge is client-side).
async function loadRelationshipPredicates(fetchTypes: typeof defaultFetchOntologyTypes): Promise<Set<string>> {
  const result = await fetchTypes(FETCH_TIMEOUT_MS);
  if (result.type === "error") return new Set();
  return new Set(result.relationships.map((entry) => entry.path));
}

function downloadJson(filename: string, body: unknown): void {
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function useVersionsList(fetchVersions: typeof defaultFetchVersions): { versions: VersionEntry[]; listError: boolean } {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [listError, setListError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVersions(FETCH_TIMEOUT_MS).then((result) => {
      if (cancelled) return;
      if (result.type === "error") {
        setListError(true);
        return;
      }
      setVersions(result.versions);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchVersions]);

  return { versions, listError };
}

// TASK-022 AC-3/AC-4/AC-6/AC-7: two-version compare state -- pulled out of
// useVersionsPanel to keep that hook under Law E's per-function line budget.
function useDiffCompare(
  adapter: RendererAdapter | null,
  engine: OverlayEngine,
  fetchDiff: typeof defaultFetchDiff,
  fetchOntologyTypes: typeof defaultFetchOntologyTypes
) {
  const [compareFrom, setCompareFrom] = useState<string | null>(null);
  const [compareTo, setCompareTo] = useState<string | null>(null);
  const [diffNote, setDiffNote] = useState<string | null>(null);
  const [diffError, setDiffError] = useState(false);
  // engine.activate/deactivate mutate the OverlayEngine directly (no React
  // state of their own) -- OverlayKey reads it back via useOverlayControls's
  // legend, which only recomputes on a re-render. setDiffNote(null) doesn't
  // force one when diffNote is *already* null (React bails out on an
  // unchanged value), silently dropping the diff legend/note. This tick
  // guarantees a re-render on every engine mutation, same pattern as
  // use-overlay-controls.ts's own forceRender.
  const [, forceRender] = useReducer((tick: number) => tick + 1, 0);

  const clearCompare = useCallback(() => {
    if (adapter && engine.isActive("diff")) engine.deactivate("diff", adapter);
    setCompareFrom(null);
    setCompareTo(null);
    setDiffNote(null);
    setDiffError(false);
    forceRender();
  }, [adapter, engine]);

  const runCompare = useCallback(
    async (from: string, to: string) => {
      if (!adapter) return;
      setDiffError(false);
      const [diffResult, relationshipPredicates] = await Promise.all([
        fetchDiff(from, to, FETCH_TIMEOUT_MS),
        loadRelationshipPredicates(fetchOntologyTypes),
      ]);
      if (diffResult.type === "error") {
        setDiffError(true);
        return;
      }
      const grouped = groupTriples(diffResult.diff, relationshipPredicates);
      if (grouped.counts.added === 0 && grouped.counts.removed === 0 && grouped.counts.modified === 0) {
        setDiffNote("No differences between these two versions.");
        return;
      }
      engine.activate(createDiffOverlay(grouped, DIFF_GLYPHS), adapter);
      setDiffNote(null);
      forceRender();
    },
    [adapter, engine, fetchDiff, fetchOntologyTypes]
  );

  const selectForCompare = useCallback(
    (iri: string) => {
      if (compareFrom && !compareTo && iri !== compareFrom) {
        setCompareTo(iri);
        runCompare(compareFrom, iri);
        return;
      }
      clearCompare();
      setCompareFrom(iri);
    },
    [clearCompare, compareFrom, compareTo, runCompare]
  );

  const exportDiff = useCallback(async () => {
    if (!compareFrom || !compareTo) return;
    const result = await fetchDiff(compareFrom, compareTo, FETCH_TIMEOUT_MS);
    if (result.type === "error") return;
    downloadJson(`diff-${compareFrom}-${compareTo}.json`, buildDiffExport(compareFrom, compareTo, result.diff, () => new Date().toISOString()));
  }, [compareFrom, compareTo, fetchDiff]);

  return { compareFrom, compareTo, diffNote, diffError, selectForCompare, clearCompare, exportDiff };
}

/** TASK-022: composes version listing (AC-1), read-only version-pinned load
 * (AC-2), two-version compare via the diff overlay (AC-3/AC-4/AC-7), export
 * (AC-6), and return-to-draft (AC-8) -- kept out of explorer-interactions.tsx
 * (already at Law E's line budget) as its own hook + presentational panel. */
export function useVersionsPanel({
  adapter,
  engine,
  fetchGraph = defaultFetchGraph,
  fetchVersions = defaultFetchVersions,
  fetchDiff = defaultFetchDiff,
  fetchOntologyTypes = defaultFetchOntologyTypes,
}: UseVersionsPanelOptions): UseVersionsPanelResult {
  const { versions, listError } = useVersionsList(fetchVersions);
  const versionMode = useVersionMode(adapter, fetchGraph);
  const compare = useDiffCompare(adapter, engine, fetchDiff, fetchOntologyTypes);

  const returnToDraft = useCallback(() => {
    compare.clearCompare();
    versionMode.returnToDraft();
  }, [compare, versionMode]);

  return {
    versions,
    listError,
    readOnly: versionMode.readOnly,
    pinnedIri: versionMode.pinnedIri,
    loadError: versionMode.error,
    compareFrom: compare.compareFrom,
    compareTo: compare.compareTo,
    diffNote: compare.diffNote,
    diffError: compare.diffError,
    selectVersion: versionMode.loadVersion,
    selectForCompare: compare.selectForCompare,
    clearCompare: compare.clearCompare,
    exportDiff: compare.exportDiff,
    returnToDraft,
  };
}
