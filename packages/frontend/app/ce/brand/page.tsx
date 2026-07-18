"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { BrandListSection } from "./brand-list";
import { ConformanceStat } from "./conformance-stat";
import { ExtractButton } from "./extract-button";
import { StandardEditDrawer } from "./standard-edit-drawer";
import { StandardForm } from "./standard-form";
import type { BrandStandardRow, VoiceRuleRow } from "./types";
import type { BrandKind } from "./use-brand-list";
import { VoiceRuleEditDrawer } from "./voice-rule-edit-drawer";
import { VoiceRuleForm } from "./voice-rule-form";

const TABS: { kind: BrandKind; label: string }[] = [
  { kind: "standard", label: "Standards" },
  { kind: "voice-rule", label: "Brand rules" },
];

function TabBar({ active, onChange }: { active: BrandKind; onChange: (kind: BrandKind) => void }) {
  return (
    <div role="tablist" className="flex gap-[var(--space-2)]">
      {TABS.map((tab) => (
        <Button
          key={tab.kind}
          role="tab"
          aria-selected={active === tab.kind}
          variant={active === tab.kind ? "primary" : "secondary"}
          onClick={() => onChange(tab.kind)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

function useEditDrawers() {
  const [editingStandard, setEditingStandard] = useState<BrandStandardRow | null>(null);
  const [editingVoiceRule, setEditingVoiceRule] = useState<VoiceRuleRow | null>(null);
  return { editingStandard, setEditingStandard, editingVoiceRule, setEditingVoiceRule };
}

/** AC-004-01..05: brand standards + brand rules -- one authoring +
 * governance home (task brief Story). Tabs switch the list + the matching
 * authoring form; a bump on `refreshKey` after a commit/edit/delete
 * re-runs the list query so the change shows up without a manual reload.
 */
export default function BrandPage() {
  const [tab, setTab] = useState<BrandKind>("standard");
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const drawers = useEditDrawers();

  function switchTab(kind: BrandKind): void {
    setTab(kind);
    setPage(0);
  }

  function onCommitted(): void {
    setPage(0);
    setRefreshKey((key) => key + 1);
  }

  function onEditSaved(): void {
    drawers.setEditingStandard(null);
    drawers.setEditingVoiceRule(null);
    onCommitted();
  }

  return (
    <main data-tour-id="ce.brand" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Branding &amp; standards
      </h1>
      <ConformanceStat />
      <ExtractButton />
      <TabBar active={tab} onChange={switchTab} />
      <Card>
        {/* Plain text, not CardTitle -- same heading-order trap ce/overview/page.tsx documents. */}
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {tab === "standard" ? "Standards" : "Brand rules"}
        </p>
        <CardContent>
          <BrandListSection
            key={refreshKey}
            kind={tab}
            page={page}
            onPageChange={setPage}
            onEditStandard={drawers.setEditingStandard}
            onEditVoiceRule={drawers.setEditingVoiceRule}
          />
        </CardContent>
      </Card>
      <Card>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          New {tab === "standard" ? "standard" : "brand rule"}
        </p>
        <CardContent>
          {tab === "standard" ? (
            <StandardForm onCommitted={onCommitted} />
          ) : (
            <VoiceRuleForm onCommitted={onCommitted} />
          )}
        </CardContent>
      </Card>
      {drawers.editingStandard && (
        <StandardEditDrawer
          row={drawers.editingStandard}
          onClose={() => drawers.setEditingStandard(null)}
          onSaved={onEditSaved}
          onDeleted={onEditSaved}
        />
      )}
      {drawers.editingVoiceRule && (
        <VoiceRuleEditDrawer
          row={drawers.editingVoiceRule}
          onClose={() => drawers.setEditingVoiceRule(null)}
          onSaved={onEditSaved}
          onDeleted={onEditSaved}
        />
      )}
    </main>
  );
}
