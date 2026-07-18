import { NotificationCards } from "./notification-cards";

/** Settings -> Notifications (mock's `#sub-set-notifications`). */
export default function NotificationsSettingsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Notifications
      </h1>
      <NotificationCards />
    </main>
  );
}
