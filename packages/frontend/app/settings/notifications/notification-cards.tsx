"use client";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { canSuppressNotificationType } from "@/app/notifications/can-suppress";
import { usePreferences, type PreferenceType } from "./use-preferences";

// ponytail: mock's 3 groups (Model/Build/Automations) don't match the real
// backend groups (Model/Build/Governance/Account) -- "Automations" has no
// backing data yet (Events & Actions engine is unbuilt, nav-items.ts marks
// it `disabled`). Rendering the real groups instead of inventing an empty
// "Automations" card or silently merging Governance/Account into it.
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

function ToggleRow({
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
    <div className="flex items-center justify-between gap-[var(--space-3)] border-t border-[var(--color-border)] py-[var(--space-2)] first:border-t-0 first:pt-0">
      <span className="font-mono text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
        {type.event_type}
      </span>
      <Switch
        aria-label={`${type.event_type} in-app`}
        data-testid={`toggle-in-app-${type.event_type}`}
        checked={type.in_app_enabled}
        disabled={locked}
        onChange={(e) => onToggle(type.event_type, e.target.checked)}
      />
    </div>
  );
}

function GroupCard({
  group,
  types,
  role,
  onToggle,
}: {
  group: string;
  types: PreferenceType[];
  role: string | null;
  onToggle: (eventType: string, nextEnabled: boolean) => void;
}) {
  return (
    <Card>
      <h2 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {group}
      </h2>
      <div className="mt-[var(--space-2)] flex flex-col">
        {types.map((type) => (
          <ToggleRow key={type.event_type} type={type} role={role} onToggle={onToggle} />
        ))}
      </div>
    </Card>
  );
}

/** Settings -> Notifications (mock `#sub-set-notifications`): one card per
 * backend preference group, each row an in-app toggle pre-filled from
 * `GET /api/notifications/preferences`. `audit.chain.invalid` stays locked
 * for workspace_admin/compliance_officer via the same
 * `canSuppressNotificationType` the bell panel uses (TASK-027 AC-6) -- no
 * `PUT` is ever constructed for a locked row. Email is a single disclaimer
 * line (mock's page-sub copy), not a fake per-row control -- there is no
 * email-notifications backend yet.
 */
export function NotificationCards() {
  const { types, role, loadError, toggleInApp } = usePreferences();

  if (loadError) {
    return (
      <p data-testid="preferences-error" className="text-[var(--color-text-muted)]">
        Unable to load notification preferences.
      </p>
    );
  }
  if (types === null) {
    return <p className="text-[var(--color-text-muted)]">Loading preferences…</p>;
  }

  const grouped = groupTypes(types);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        What lands in your bell. Email digests arrive in a later release.
      </p>
      {GROUP_ORDER.filter((group) => (grouped.get(group) ?? []).length > 0).map((group) => (
        <GroupCard key={group} group={group} types={grouped.get(group) ?? []} role={role} onToggle={toggleInApp} />
      ))}
    </div>
  );
}
