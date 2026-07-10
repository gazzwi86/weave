"use client";

import type { ClosurePredicateEntry } from "@/lib/explorer/closure-config";
import type { FetchOntologyTypesResult } from "@/lib/explorer/fetch-ontology-types";

export type ClosureGuardStatus = "checking" | "ok" | "drift";

export interface ClosureGuardState {
  status: ClosureGuardStatus;
  missing: string[];
  message: string | null;
}

// ponytail: type-complete throwing stub -- real body lands next commit
// (keeps tsc clean while the test is red on assertion, not on types).
export function useClosureGuard(
  _closure: ClosurePredicateEntry[],
  _fetchTypes: (timeoutMs: number) => Promise<FetchOntologyTypesResult>,
): ClosureGuardState {
  throw new Error("not implemented");
}
