"use client";

import { useEffect, useState } from "react";

import type { ClosurePredicateEntry } from "@/lib/explorer/closure-config";
import type { FetchOntologyTypesResult } from "@/lib/explorer/fetch-ontology-types";
import { describeDrift, validateClosure } from "@/lib/explorer/validate-closure";

export type ClosureGuardStatus = "checking" | "ok" | "drift";

export interface ClosureGuardState {
  status: ClosureGuardStatus;
  missing: string[];
  message: string | null;
}

const CHECKING: ClosureGuardState = { status: "checking", missing: [], message: null };

// TASK-028 AC-2: a types-fetch failure (network/503) can't tell us whether
// the closure resolves clean, so it degrades to "drift" (traversal
// disabled) the same as an actual missing predicate -- never a silent
// pass. `closure` itself names every entry so the banner stays useful.
function driftFromFetchFailure(closure: ClosurePredicateEntry[]): ClosureGuardState {
  const missing = closure.map((entry) => entry.predicate);
  return { status: "drift", missing, message: describeDrift(missing) };
}

/** TASK-028 AC-2: boot-time drift guard, run once per mount alongside the
 * canvas's own palette fetch (a separate concern from useExplorerCanvas --
 * composed side by side, not sequenced inside its load effect, so a
 * traversal-config problem never blocks the graph itself from loading). */
export function useClosureGuard(
  closure: ClosurePredicateEntry[],
  fetchTypes: (timeoutMs: number) => Promise<FetchOntologyTypesResult>,
  timeoutMs = 10_000,
): ClosureGuardState {
  const [state, setState] = useState<ClosureGuardState>(CHECKING);

  useEffect(() => {
    let cancelled = false;

    fetchTypes(timeoutMs).then((result) => {
      if (cancelled) return;
      if (result.type === "error") {
        setState(driftFromFetchFailure(closure));
        return;
      }
      const validation = validateClosure(closure, result.relationships);
      setState(
        validation.ok
          ? { status: "ok", missing: [], message: null }
          : { status: "drift", missing: validation.missing, message: describeDrift(validation.missing) },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [closure, fetchTypes, timeoutMs]);

  return state;
}
