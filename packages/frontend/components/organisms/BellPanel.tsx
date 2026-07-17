import type { ReactNode } from "react";

import { canSuppressNotificationType } from "@/app/notifications/can-suppress";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { RelativeTime } from "@/components/molecules/RelativeTime";
import { cn } from "@/lib/utils";

/** refit-mock.html's `.ni` category tones (`c-model`/`c-build`/`c-member`) --
 * `undefined` falls back to a neutral chip so an uncategorised event type
 * never renders unstyled. */
export type BellCategory = "model" | "build" | "member";

const CATEGORY_ICON: Record<BellCategory, IconName> = {
  model: "graph",
  build: "layers",
  member: "user",
};

const CATEGORY_TONE_CLASS: Record<BellCategory, string> = {
  model: "text-[var(--color-accent-primary)]",
  build: "text-[var(--color-kind-system)]",
  member: "text-[var(--color-kind-actor)]",
};

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
  /** Row icon-chip category (refit-mock.html's `.ni` tones); absent renders
   * a neutral chip rather than guessing. */
  category?: BellCategory;
}

export interface BellPanelProps {
  notifications: BellPanelNotification[];
  /** Signed-in viewer's role -- gates the per-row mute control (AC-6). */
  role?: string | null;
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onMute?: (eventType: string) => void;
  /** Smart Dialog.Close element from the wrapper -- BellPanel only places it
   * in the header (refit-mock.html icon-only X); it never owns dialog state,
   * same slot pattern as AppHeader's notifications/help/account props. */
  closeSlot?: ReactNode;
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

/** refit-mock.html's `.flyout-head`: gradient `.fh-icon` chip + title, the
 * mark-all-read ghost button, and the wrapper's close-button slot. */
function PanelHeader({
  hasNotifications,
  onMarkAllRead,
  closeSlot,
}: {
  hasNotifications: boolean;
  onMarkAllRead?: () => void;
  closeSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[var(--space-2)] border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
      <span className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] bg-[image:var(--gradient-accent)] text-[var(--color-bg)]">
        <Icon name="bell" size={15} />
      </span>
      <p className="flex-1 text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Notifications
      </p>
      {hasNotifications && onMarkAllRead ? (
        <Button variant="ghost" onClick={onMarkAllRead} className="gap-[var(--space-1)]">
          <Icon name="check-all" size={12} />
          Mark all read
        </Button>
      ) : null}
      {closeSlot}
    </div>
  );
}

/** refit-mock.html's `.ni` category chip, sized to `--space-6` -- `undefined`
 * falls back to the neutral bell glyph rather than guessing a category. */
function RowIcon({ category }: { category?: BellCategory }) {
  return (
    <span
      className={cn(
        "flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)]",
        category ? CATEGORY_TONE_CLASS[category] : "text-[var(--color-text-muted)]"
      )}
    >
      <Icon name={category ? CATEGORY_ICON[category] : "bell"} size={14} />
    </span>
  );
}

/** refit-mock.html's `.nd` unread dot plus the row's real mute/mark-read
 * controls -- the dot is purely decorative (AC-4 read state is carried by
 * the buttons below it, never colour alone). */
function RowActions({
  notification,
  suppressible,
  onMarkRead,
  onMute,
}: {
  notification: BellPanelNotification;
  suppressible: boolean;
  onMarkRead?: (id: string) => void;
  onMute?: (eventType: string) => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-[var(--space-2)]">
      <span
        aria-hidden="true"
        className={cn(
          "h-[var(--space-1)] w-[var(--space-1)] shrink-0 rounded-[var(--radius-full)]",
          notification.read ? "bg-transparent" : "bg-[var(--color-accent-primary)]"
        )}
      />
      <div className="flex items-center gap-[var(--space-2)]">
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
    <li className="flex items-start gap-[var(--space-2)] border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] transition-colors hover:bg-[var(--color-hover)]">
      <RowIcon category={notification.category} />
      <div className="min-w-0 flex-1">
        {notification.targetIri ? (
          <a href={resourceHref(notification.targetIri)} className="font-[var(--font-weight-semibold)] hover:underline">
            {label}
          </a>
        ) : (
          <span className="font-[var(--font-weight-semibold)]">{label}</span>
        )}
        <RelativeTime iso={notification.createdAt} className="block text-[length:var(--text-caption)] text-[var(--color-text-subtle)]" />
      </div>
      <RowActions notification={notification} suppressible={suppressible} onMarkRead={onMarkRead} onMute={onMute} />
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
  closeSlot,
  className,
}: BellPanelProps) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "flex max-h-[calc(100vh-var(--space-10))] w-[var(--size-flyout)] max-w-full flex-col overflow-hidden rounded-[var(--radius-lg)]",
        "border border-[var(--color-border-strong)] bg-[var(--color-overlay)]/[.72] shadow-[var(--shadow-overlay)] backdrop-blur-md",
        "animate-[flyDown_var(--duration-base)_var(--ease-standard)]",
        className
      )}
    >
      <PanelHeader hasNotifications={notifications.length > 0} onMarkAllRead={onMarkAllRead} closeSlot={closeSlot} />
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="p-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            No notifications yet.
          </p>
        ) : (
          groupByDay(notifications).map(([heading, rows]) => (
            <div key={heading}>
              <p className="px-[var(--space-4)] pb-[var(--space-1)] pt-[var(--space-3)] text-[length:var(--text-overline)] uppercase text-[var(--color-text-subtle)]">
                {heading}
              </p>
              <ul>
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
    </div>
  );
}
