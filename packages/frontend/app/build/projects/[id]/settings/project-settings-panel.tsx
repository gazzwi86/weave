"use client";

import { useState } from "react";

import { BindingSlots } from "./binding-slots";
import { ContributorsTab } from "./contributors-tab";
import { GovernanceForm } from "./governance-form";
import { useProjectSettings } from "./use-project-settings";

const TABS = ["Governance", "Connections", "Contributors"] as const;
type Tab = (typeof TABS)[number];

function TabList({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }): React.JSX.Element {
  return (
    <div role="tablist" className="flex gap-[var(--space-2)] border-b border-[var(--color-border)]">
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onSelect(tab)}
          className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] aria-selected:border-b-2 aria-selected:border-[var(--color-accent-primary)] aria-selected:font-[var(--font-weight-semibold)]"
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/** TASK-015 project settings page (AC-1..AC-7, EPIC-002). Governance
 * (model tier + cost cap) is read-only for non-admins (AC-4); Connections
 * (AC-7) and Contributors (AC-5) are separate tabs. */
export function ProjectSettingsPanel({
  projectId,
  tenantRole,
  principalIri,
}: {
  projectId: string;
  tenantRole: string | null;
  principalIri: string | null;
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("Governance");
  const settings = useProjectSettings(projectId, tenantRole, principalIri);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <TabList active={tab} onSelect={setTab} />
      {settings.error && (
        <p role="alert" className="text-[var(--color-danger)]">
          {settings.error}
        </p>
      )}
      {settings.saved && (
        <p role="status" className="text-[var(--color-success)]">
          Saved.
        </p>
      )}
      {tab === "Governance" && settings.values && settings.source && (
        <GovernanceForm
          values={settings.values}
          source={settings.source}
          canManage={settings.canManage}
          saving={settings.saving}
          onChange={settings.setValues}
          onSave={settings.save}
        />
      )}
      {tab === "Connections" && <BindingSlots />}
      {tab === "Contributors" && (
        <ContributorsTab projectId={projectId} canManage={settings.canManage} />
      )}
    </div>
  );
}
