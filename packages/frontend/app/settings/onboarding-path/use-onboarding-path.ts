import { useCallback, useEffect, useState } from "react";

export type RolePath = "business" | "technical" | "compliance" | "admin";

export interface OnboardingPath {
  role_path: RolePath;
  path_variant: "default" | "read_only";
  path_chosen_manually: boolean;
  needs_choice: boolean;
}

export interface OnboardingPathState {
  /** null while first load is in flight (or it failed). */
  path: OnboardingPath | null;
  loadError: boolean;
  /** AC-006-04: "change my onboarding path" -- persists immediately. */
  changePath: (next: RolePath) => Promise<void>;
}

/** Drives Settings -> Onboarding path: loads the resolved/persisted path
 * (ONB-TASK-006 GET /api/onboarding/path) and PUTs a manual change.
 */
export function useOnboardingPath(): OnboardingPathState {
  const [path, setPath] = useState<OnboardingPath | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/onboarding/path", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<OnboardingPath>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPath(data);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const changePath = useCallback(async (next: RolePath): Promise<void> => {
    const res = await fetch("/api/onboarding/path", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_path: next }),
    });
    if (!res.ok) return;
    setPath((await res.json()) as OnboardingPath);
  }, []);

  return { path, loadError, changePath };
}
