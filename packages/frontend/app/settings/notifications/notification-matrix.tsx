"use client";

import { Card, CardContent } from "@/components/ui/card";
import { canSuppressNotificationType } from "@/app/notifications/can-suppress";
import { usePreferences, type PreferenceType } from "./use-preferences";

const GROUP_ORDER = ["Model", "Build", "Governance", "Account"];

function groupTypes(types: PreferenceType[]): Map<string, PreferenceType[]> {
  const byGroup = new Map<string, PreferenceType[]>();
  for (const group of GROUP_ORDER) byGroup.set(group, []);
  for (const t of types) {
    const bucket = byGroup.get(t.group) ?? [];
    bucket.push(t);
    byGroup.set(t.group, bucket);
  }
  return byGroup;
}

function MatrixRow({
  type,
  role,
  onToggle,
}: {
  type: PreferenceType;
  role: string | null;
  onToggle: (eventType: string, nextEnabled: boolean) => void;
}) {
  const locked = !canSuppressNotificationType(type.event_type, role);
  return (
    <tr className="border-t border-[var(--color-border)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
      <td className="px-[var(--space-3)] py-[var(--space-2)]">{type.event_type}</td>
      <td className="px-[var(--space-3)] py-[var(--space-2)]">
        <input
          type="checkbox"
          aria-label={`${type.event_type} in-app`}
          data-testid={`toggle-in-app-${type.event_type}`}
          checked={type.in_app_enabled}
          disabled={locked}
          onChange={(e) => onToggle(type.event_type, e.target.checked)}
        />
      </td>
      <td className="px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-[var(--space-1)]">
          <input type="checkbox" aria-label={`${type.event_type} email`} checked={false} disabled />
          <span
            data-testid={`email-pill-${type.event_type}`}
            className="rounded-[var(--radius-full)] bg-[var(--color-hover)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-overline)]"
          >
            post-v1
          </span>
        </span>
      </td>
    </tr>
  );
}

/** Settings -> Notifications (AC-5/AC-6): 8x2 matrix (in-app togglable,
 * email disabled+"post-v1" pill), grouped Model/Build/Governance/Account,
 * pre-filled from `GET /api/notifications/preferences`. The
 * `audit.chain.invalid` row is locked for workspace_admin/compliance_officer
 * via the same `canSuppressNotificationType` the bell panel uses
 * (TASK-027 AC-6) -- no `PUT` is ever constructed for a locked row.
 */
export function NotificationMatrix() {
  const { types, role, loadError, toggleInApp } = usePreferences();

  if (loadError) {
    return <p data-testid="preferences-error" className="text-[var(--color-text-muted)]">Unable to load notification preferences.</p>;
  }
  if (types === null) {
    return <p className="text-[var(--color-text-muted)]">Loading preferences…</p>;
  }

  const grouped = groupTypes(types);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {GROUP_ORDER.filter((group) => (grouped.get(group) ?? []).length > 0).map((group) => (
        <Card key={group}>
          <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {group}
          </p>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="text-[length:var(--text-overline)] text-[var(--color-text-muted)]">
                  <th className="px-[var(--space-3)] py-[var(--space-2)] text-left">Event</th>
                  <th className="px-[var(--space-3)] py-[var(--space-2)] text-left">In-app</th>
                  <th className="px-[var(--space-3)] py-[var(--space-2)] text-left">Email</th>
                </tr>
              </thead>
              <tbody>
                {(grouped.get(group) ?? []).map((type) => (
                  <MatrixRow key={type.event_type} type={type} role={role} onToggle={toggleInApp} />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
