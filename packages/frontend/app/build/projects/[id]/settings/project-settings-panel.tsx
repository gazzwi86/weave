"use client";

import { useState } from "react";

import { BindingSlots } from "./binding-slots";
import { ContributorsTab } from "./contributors-tab";
import { GovernanceForm } from "./governance-form";
import { PinUpgradeSection } from "./pin-upgrade-section";
import { SourceControlTab } from "./source-control-tab";
import { useProjectSettings } from "./use-project-settings";

const TABS = ["Governance", "Connections", "Contributors", "Source control"] as const;
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

function StatusBanners({ error, saved }: { error: string | null; saved: boolean }): React.JSX.Element {
  return (
    <>
      {error && (
        <p id="settings-error" role="alert" className="text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-[var(--color-success)]">
          Saved.
        </p>
      )}
    </>
  );
}

/** TASK-015 project settings page (AC-1..AC-7, EPIC-002). Governance
 * (model tier + cost cap) is read-only for non-admins (AC-4); Connections
 * (AC-7), Contributors (AC-5), and Source control (TASK-023) are separate
 * tabs. */
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
      <StatusBanners error={settings.error} saved={settings.saved} />
      {tab === "Governance" && settings.values && settings.source && (
        <>
          <GovernanceForm
            values={settings.values}
            source={settings.source}
            canManage={settings.canManage}
            saving={settings.saving}
            costCapInvalid={settings.costCapInvalid}
            errorId="settings-error"
            onChange={settings.setValues}
            onSave={settings.save}
          />
          <PinUpgradeSection projectId={projectId} canManage={settings.canManage} />
        </>
      )}
      {tab === "Connections" && (
        <BindingSlots projectId={projectId} canManage={settings.canManage} />
      )}
      {tab === "Contributors" && (
        <ContributorsTab projectId={projectId} canManage={settings.canManage} />
      )}
      {tab === "Source control" && (
        <SourceControlTab projectId={projectId} canManage={settings.canManage} />
      )}
    </div>
  );
}
