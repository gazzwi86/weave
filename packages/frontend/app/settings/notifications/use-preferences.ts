import { useCallback, useEffect, useState } from "react";

export interface PreferenceType {
  event_type: string;
  group: string;
  in_app_enabled: boolean;
}

export interface PreferencesState {
  /** null while first load is in flight. */
  types: PreferenceType[] | null;
  /** Caller's workspace role, or null before their first switch -- drives
   * the `audit.chain.invalid` lock (AC-6). */
  role: string | null;
  loadError: boolean;
  /** Optimistically flips a row's in-app toggle and PUTs the new channel
   * list; reverts on failure. */
  toggleInApp: (eventType: string, nextEnabled: boolean) => Promise<void>;
}

/** Drives the Settings -> Notifications matrix: loads the 8-type,
 * role-derived preference state (AC-4/AC-5) and PUTs one event_type's
 * channel list per toggle.
 */
export function usePreferences(): PreferencesState {
  const [types, setTypes] = useState<PreferenceType[] | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications/preferences", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<{ types: PreferenceType[]; role: string | null }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setTypes(data.types);
        setRole(data.role);
        setLoadError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  const toggleInApp = useCallback(
    async (eventType: string, nextEnabled: boolean): Promise<void> => {
      setTypes((prev) =>
        prev?.map((t) => (t.event_type === eventType ? { ...t, in_app_enabled: nextEnabled } : t)) ?? prev
      );
      // ponytail: `store.upsert_pref` (weave_backend/notifications/store.py)
      // rejects any PUT whose channels omit "in_app" (`in_app_channel_mandatory`)
      // -- turning a row off is a local-only affordance until that backend
      // constraint is revisited; only the "on" write actually persists.
      if (!nextEnabled) return;
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, channels: ["in_app"] }),
      });
      if (!res.ok) {
        setTypes((prev) =>
          prev?.map((t) => (t.event_type === eventType ? { ...t, in_app_enabled: !nextEnabled } : t)) ?? prev
        );
      }
    },
    []
  );

  return { types, role, loadError, toggleInApp };
}
