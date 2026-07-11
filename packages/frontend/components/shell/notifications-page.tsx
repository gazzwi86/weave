"use client";

import { BellPanel, type BellPanelNotification } from "@/components/organisms/BellPanel";
import { groupBellEntries } from "@/app/notifications/group-bell-entries";

import { useNotifications } from "./use-notifications";

/** AC-4 full-page notifications view, reachable from the primary nav --
 * same `BellPanel` organism the header trigger renders, so day-grouping,
 * deep-links, and mark-read/mark-all-read stay identical between the two
 * entry points. Lives in `components/shell/**` (not `app/**`) so it can
 * import the organism directly per the app-layer import boundary. */
export function NotificationsPage() {
  const { notifications, error, markRead } = useNotifications();

  const grouped = groupBellEntries(notifications, notifications[0]?.created_at ?? new Date().toISOString());
  const bellNotifications: BellPanelNotification[] = grouped.map((entry) => ({
    id: entry.id,
    label: entry.event_type,
    eventType: entry.event_type,
    read: entry.read,
    createdAt: entry.created_at,
    targetIri: entry.target_iri,
    summary: entry.summary,
  }));

  const markAllRead = async () => {
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markRead(n.id)));
  };

  if (error) {
    return (
      <p className="p-[var(--space-5)] text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        Couldn&apos;t load notifications.
      </p>
    );
  }

  return (
    <BellPanel
      notifications={bellNotifications}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      className="max-w-none border-l-0"
    />
  );
}
