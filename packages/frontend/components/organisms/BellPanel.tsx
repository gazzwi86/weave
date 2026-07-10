import { cn } from "@/lib/utils";

export interface BellPanelNotification {
  id: string;
  label: string;
  read: boolean;
}

export interface BellPanelProps {
  notifications: BellPanelNotification[];
  onMarkRead?: (id: string) => void;
  className?: string;
}

/** Notification list panel (extracted from the stateful
 * `components/shell/notification-center.tsx`, which owns the Radix Dialog,
 * unread count, and fetch/refresh). */
export function BellPanel({ notifications, onMarkRead, className }: BellPanelProps) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      className={cn(
        "h-full w-full max-w-xs border-l border-[var(--color-border)] bg-[var(--color-surface)]",
        "p-[var(--space-5)] shadow-[var(--shadow-panel)]",
        className
      )}
    >
      <p className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Notifications
      </p>
      {notifications.length === 0 ? (
        <p className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          No notifications yet.
        </p>
      ) : (
        <ul className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="flex items-center justify-between gap-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
            >
              <span>{notification.label}</span>
              {!notification.read && (
                <button
                  type="button"
                  onClick={() => onMarkRead?.(notification.id)}
                  className="text-[length:var(--text-label)] text-[var(--color-info)] hover:text-[var(--color-text-default)]"
                >
                  Mark read
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
