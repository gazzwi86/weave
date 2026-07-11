"use client";

import { useCallback, useEffect, useState } from "react";

import type { ValidateResponse } from "./types";

export interface RulesState {
  report: ValidateResponse | null;
  loading: boolean;
  error: boolean;
  /** Triggers the heavy `run=true` pass on a cache miss (AC-006-04). */
  run: () => Promise<void>;
}

async function fetchValidate(run: boolean): Promise<ValidateResponse> {
  const response = await fetch(`/api/proxy/validate?version=draft${run ? "&run=true" : ""}`);
  if (!response.ok) throw new Error(`validate_failed_${response.status}`);
  return (await response.json()) as ValidateResponse;
}

/** AC-006-03/-04/-05: loads the cache-only report on mount (a miss is the
 * honest `{"pending": true}`, never a stale or fake-zero report) and
 * exposes `run` to trigger the real SHACL pass on demand. `runToken`
 * distinguishes the initial cache-only load from an explicit `run` call
 * without calling a shared setState-ing helper directly inside the
 * effect body (react-hooks/set-state-in-effect). */
export function useRules(): RulesState {
  const [report, setReport] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchValidate(runToken > 0)
      .then((body) => {
        if (cancelled) return;
        setReport(body);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runToken]);

  const run = useCallback(async () => {
    setLoading(true);
    setRunToken((token) => token + 1);
  }, []);

  return { report, loading, error, run };
}
