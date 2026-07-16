import { canSuppressNotificationType } from "@/app/notifications/can-suppress";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/molecules/RelativeTime";
import { cn } from "@/lib/utils";

export interface BellPanelNotification {
  id: string;
  label: string;
  /** Registered PLAT-NOTIFY-1 event type -- drives the non-suppressible gate. */
  eventType: string;
  read: boolean;
  createdAt: string;
  /** Deep-link target (CE-READ-1 resource IRI); absent rows render with no link. */
  targetIri?: string;
  /** Present only for a batched model.version.published row. */
  summary?: string;
}

export interface BellPanelProps {
  notifications: BellPanelNotification[];
  /** Signed-in viewer's role -- gates the per-row mute control (AC-6). */
  role?: string | null;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onMute?: (eventType: string) => void;
  className?: string;
}

function dayHeading(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Groups already-sorted (newest-first) notifications into day buckets,
 * preserving order within and across days. */
function groupByDay(notifications: BellPanelNotification[]): [string, BellPanelNotification[]][] {
  const buckets = new Map<string, BellPanelNotification[]>();
  for (const notification of notifications) {
    const heading = dayHeading(notification.createdAt);
    const bucket = buckets.get(heading) ?? [];
    bucket.push(notification);
    buckets.set(heading, bucket);
  }
  return [...buckets.entries()];
}

function resourceHref(targetIri: string): string {
  return `/ce/resource?iri=${encodeURIComponent(targetIri)}`;
}

function PanelHeader({ hasNotifications, onMarkAllRead }: { hasNotifications: boolean; onMarkAllRead?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Notifications
      </p>
      {hasNotifications && onMarkAllRead ? (
        <Button variant="ghost" onClick={onMarkAllRead}>
          Mark all read
        </Button>
      ) : null}
    </div>
  );
}

function BellRow({
  notification,
  role,
  onMarkRead,
  onMute,
}: {
  notification: BellPanelNotification;
  role?: string | null;
  onMarkRead?: (id: string) => void;
  onMute?: (eventType: string) => void;
}) {
  const label = notification.summary ?? notification.label;
  const suppressible = canSuppressNotificationType(notification.eventType, role ?? null);

  return (
    <li className="flex items-start justify-between gap-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        {notification.targetIri ? (
          <a href={resourceHref(notification.targetIri)} className="hover:underline">
            {label}
          </a>
        ) : (
          <span>{label}</span>
        )}
        <RelativeTime iso={notification.createdAt} />
      </div>
      <div className="flex shrink-0 items-center gap-[var(--space-2)]">
        {suppressible && onMute ? (
          <Button variant="ghost" onClick={() => onMute(notification.eventType)}>
            Mute
          </Button>
        ) : null}
        {!notification.read && onMarkRead ? (
          <Button variant="ghost" onClick={() => onMarkRead(notification.id)}>
            Mark read
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Day-grouped notification list panel (AC-4/5/6): each row deep-links to
 * its `target_iri`, shows a relative timestamp, and a mark-read control;
 * the panel carries one mark-all-read control. A row's mute control is
 * gated by `canSuppressNotificationType` -- never rendered when the type is
 * `audit.chain.invalid` and the viewer is a workspace admin/compliance
 * officer, so there is no client path that can reach the preferences PUT
 * for that combination. */
export function BellPanel({
  notifications,
  role = null,
  onMarkRead,
  onMarkAllRead,
  onMute,
  className,
}: BellPanelProps) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "h-full w-full max-w-xs border-l border-[var(--color-border)] bg-[var(--color-overlay)]/80 backdrop-blur-md",
        "p-[var(--space-5)] shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <PanelHeader hasNotifications={notifications.length > 0} onMarkAllRead={onMarkAllRead} />
      {notifications.length === 0 ? (
        <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          No notifications yet.
        </p>
      ) : (
        groupByDay(notifications).map(([heading, rows]) => (
          <div key={heading} className="mt-[var(--space-4)]">
            <p className="pb-[var(--space-1)] text-[length:var(--text-overline)] uppercase text-[var(--color-text-muted)]">
              {heading}
            </p>
            <ul className="flex flex-col gap-[var(--space-3)]">
              {rows.map((notification) => (
                <BellRow
                  key={notification.id}
                  notification={notification}
                  role={role}
                  onMarkRead={onMarkRead}
                  onMute={onMute}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
