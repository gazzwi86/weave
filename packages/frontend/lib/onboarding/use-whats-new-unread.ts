import { useCallback, useEffect, useState } from "react";

import { WHATS_NEW_ITEMS } from "../../../shared/onboarding/content/whats-new";

export interface UseWhatsNewUnreadResult {
  loading: boolean;
  unread: boolean;
  markSeen: () => Promise<void>;
}

function newestPublishedAt(): number {
  return Math.max(...WHATS_NEW_ITEMS.map((item) => new Date(item.publishedAt).getTime()), 0);
}

/**
 * ONB-TASK-012: unread dot = one timestamp cursor (`whats_new_seen_at`),
 * exposed here so the launcher (TASK-013) consumes it without duplicating
 * cursor logic (brief's implementation hint).
 */
export function useWhatsNewUnread(): UseWhatsNewUnreadResult {
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/state")
      .then((res) => res.json())
      .then((body: { whats_new_seen_at?: string | null }) => {
        if (!cancelled) setSeenAt(body.whats_new_seen_at ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(async () => {
    const now = new Date().toISOString();
    setSeenAt(now);
    await fetch("/api/onboarding/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ whats_new_seen_at: now }),
    });
  }, []);

  const unread = WHATS_NEW_ITEMS.length > 0 && (!seenAt || new Date(seenAt).getTime() < newestPublishedAt());

  return { loading, unread, markSeen };
}
