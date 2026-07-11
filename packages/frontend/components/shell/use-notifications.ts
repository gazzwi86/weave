import { useCallback, useEffect, useState } from "react";

export interface NotificationItem {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  delivered_channels: string[];
  read: boolean;
  created_at: string;
  /** Deep-link target (CE-READ-1 resource IRI) -- absent for types with no
   * single graph resource to link to. */
  target_iri?: string;
}

interface NotificationListResponse {
  notifications: NotificationItem[];
}

export interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
  /** True when the last fetch failed (network/upstream error) -- distinct
   * from a real empty-results response. */
  error: boolean;
  /** Re-fetches the unread list -- called when the panel opens, not on a
   * timer (ponytail: no polling/SSE infra for M1; the badge/panel are only
   * ever this fresh as of the last mount or open). */
  refresh: () => void;
  markRead: (id: string) => Promise<void>;
}

/** AC-2/AC-6: fetches unread notifications for the nav badge/panel, and
 * marks one read both on the backend and in local state so the badge count
 * updates without a full re-fetch.
 */
export function useNotifications(): NotificationsState {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/notifications?unread=true", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error("notifications_failed");
        }
        return res.json() as Promise<NotificationListResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        setNotifications(data.notifications);
        setError(false);
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setError(true);
      });
    return () => controller.abort();
  }, [version]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, error, refresh, markRead };
}
