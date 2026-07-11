import { useCallback, useEffect, useState } from "react";

export interface TileState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** AC-1/AC-2: each tile fetches its own `/dashboard/{tile}` endpoint,
 * independently -- no shared client/cache, so one tile's fetch failing
 * can never touch another tile's state (isolation is structural, same
 * per-hook-per-concern pattern as `use-project-settings.ts`).
 */
export function useTile<T>(projectId: string, tile: string): TileState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/build/projects/${projectId}/dashboard/${tile}`)
      .then((res) => {
        if (!res.ok) throw new Error(`tile ${tile} failed`);
        return res.json() as Promise<T>;
      })
      .then((body) => {
        if (!cancelled) setData(body);
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
  }, [projectId, tile, attempt]);

  // Reset happens here (an event handler), not in the effect body itself
  // -- react-hooks/set-state-in-effect flags a synchronous setState as the
  // first line of an effect; the initial mount already starts loading/
  // error at their correct defaults, so only a retry needs the reset.
  const retry = useCallback(() => {
    setLoading(true);
    setError(false);
    setAttempt((a) => a + 1);
  }, []);

  return { data, loading, error, retry };
}
