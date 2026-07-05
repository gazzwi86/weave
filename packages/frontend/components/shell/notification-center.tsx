"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Badge } from "@/components/ui/badge";

import { useNotifications, type NotificationItem } from "./use-notifications";

function NotificationList({
  notifications,
  error,
  markRead,
}: {
  notifications: NotificationItem[];
  error: boolean;
  markRead: (id: string) => Promise<void>;
}) {
  if (error) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        Couldn&apos;t load notifications.
      </p>
    );
  }
  if (notifications.length === 0) {
    return (
      <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        No notifications yet.
      </p>
    );
  }
  return (
    <ul className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
        >
          <span>{notification.event_type}</span>
          {!notification.read && (
            <button
              type="button"
              onClick={() => markRead(notification.id)}
              className="text-[length:var(--text-label)] text-[var(--color-info)] hover:text-[var(--color-text-default)]"
            >
              Mark read
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** AC-2/AC-6: nav badge showing the unread count, opening a panel (same
 * Radix Dialog pattern as help-launcher.tsx) listing notifications with a
 * mark-read affordance per unread item.
 */
export function NotificationCenter() {
  const { notifications, unreadCount, error, refresh, markRead } = useNotifications();

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          refresh();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Notifications
          {unreadCount > 0 && <Badge variant="info">{unreadCount}</Badge>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)]" />
        <Dialog.Content
          aria-label="Notifications"
          className="fixed right-0 top-0 h-full w-full max-w-[360px] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]"
        >
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Notifications
          </Dialog.Title>

          <NotificationList notifications={notifications} error={error} markRead={markRead} />

          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close notifications"
              className="mt-[var(--space-4)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
