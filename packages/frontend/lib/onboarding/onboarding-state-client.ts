/**
 * H8: `/api/onboarding/state` was fetched once per mounted reader -- up to
 * 4x on a single dashboard load (PracticeModeBanner, OnboardingHintsHost's
 * useDismissals, HelpLauncher's useWhatsNewUnread, ChecklistWidget), since
 * each read it directly in its own mount-time `useEffect`. All four now
 * call this instead: whichever reader fires first starts the request, the
 * rest reuse that same in-flight promise, and the cache clears once it
 * resolves so the next page load (or an explicit `refresh()`, which still
 * calls `fetch` directly) reads fresh state.
 */
let inFlight: Promise<Record<string, unknown> | null> | null = null;

export function fetchOnboardingStateOnce(): Promise<Record<string, unknown> | null> {
  if (!inFlight) {
    inFlight = fetch("/api/onboarding/state")
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, unknown>>) : null))
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
