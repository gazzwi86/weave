"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { BellPanel, type BellCategory, type BellPanelNotification } from "@/components/organisms/BellPanel";
import { groupBellEntries } from "@/app/notifications/group-bell-entries";

import { useNotifications } from "./use-notifications";

/** Humanises a PLAT-NOTIFY-1 event_type ("job.completed") into a row label
 * ("Job completed") -- no per-type copy table exists yet, this is the
 * mechanical fallback until product supplies one. */
function labelFor(eventType: string): string {
  return eventType;
}

/** ponytail: mechanical prefix match, no per-type category table exists yet
 * (same stopgap as `labelFor`). `undefined` -> BellPanel's neutral chip. */
function categoryFor(eventType: string): BellCategory | undefined {
  if (eventType.startsWith("model.") || eventType.startsWith("ontology.")) return "model";
  if (eventType.startsWith("job.") || eventType.startsWith("build.")) return "build";
  if (eventType.startsWith("workspace.member") || eventType.startsWith("member.")) return "member";
  return undefined;
}

/** AC-4: bell icon + unread badge (never a bare text label) opening a
 * day-grouped `BellPanel`. AC-5's session-scoped `model.version.published`
 * batching runs client-side via `groupBellEntries` before the panel renders.
 */
function toBellNotifications(notifications: ReturnType<typeof groupBellEntries>): BellPanelNotification[] {
  return notifications.map((entry) => ({
    id: entry.id,
    label: labelFor(entry.event_type),
    eventType: entry.event_type,
    read: entry.read,
    createdAt: entry.created_at,
    targetIri: entry.target_iri,
    summary: entry.summary,
    category: categoryFor(entry.event_type),
  }));
}

function BellTrigger({ unreadCount }: { unreadCount: number }) {
  return (
    <>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <Badge variant="info" className="absolute -right-1 -top-1">
          {unreadCount}
        </Badge>
      )}
    </>
  );
}

function CloseNotificationsButton() {
  return (
    <Dialog.Close asChild>
      <button
        type="button"
        aria-label="Close notifications"
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
      >
        <Icon name="x" size={14} />
      </button>
    </Dialog.Close>
  );
}

function NotificationsBody({
  error,
  bellNotifications,
  role,
  markRead,
  markAllRead,
}: {
  error: boolean;
  bellNotifications: BellPanelNotification[];
  role?: string | null;
  markRead: (id: string) => void;
  markAllRead: () => void;
}) {
  if (error) {
    return (
      <p className="w-[380px] max-w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-[var(--space-5)] text-[length:var(--text-body-sm)] text-[var(--color-danger)] shadow-[var(--shadow-overlay)]">
        Couldn&apos;t load notifications.
      </p>
    );
  }
  return (
    <BellPanel
      notifications={bellNotifications}
      role={role}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      closeSlot={<CloseNotificationsButton />}
    />
  );
}

export function NotificationCenter({ role = null }: { role?: string | null }) {
  const { notifications, unreadCount, error, refresh, markRead } = useNotifications();

  const sessionStart = notifications[0]?.created_at ?? new Date().toISOString();
  const bellNotifications = toBellNotifications(groupBellEntries(notifications, sessionStart));

  const markAllRead = async () => {
    await Promise.all(notifications.filter((n) => !n.read).map((n) => markRead(n.id)));
  };

  return (
    <Dialog.Root onOpenChange={(open) => open && refresh()}>
      <Dialog.Trigger
        aria-label="Notifications"
        className="relative flex items-center justify-center rounded-[var(--radius-full)] p-[var(--space-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
      >
        <BellTrigger unreadCount={unreadCount} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content asChild aria-label="Notifications" className="fixed right-[var(--space-4)] top-[var(--space-10)]">
          <div>
            <Dialog.Title className="sr-only">Notifications</Dialog.Title>
            <NotificationsBody
              error={Boolean(error)}
              bellNotifications={bellNotifications}
              role={role}
              markRead={markRead}
              markAllRead={markAllRead}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
