"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { NlRuleDrawer } from "./nl-rule-drawer";
import { PoliciesSection } from "./policies-section";
import { RulesTable } from "./rules-table";
import { RulesTour } from "./rules-tour";
import type { RulesState } from "./use-rules";
import { useRules } from "./use-rules";

type Tab = "rules" | "policies";
const TABS: { key: Tab; label: string }[] = [
  { key: "rules", label: "Rules" },
  { key: "policies", label: "Policies" },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div role="tablist" className="flex gap-[var(--space-2)]">
      {TABS.map((tab) => (
        <Button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          variant={active === tab.key ? "primary" : "secondary"}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

/** Splits the body branching out of the page component to keep
 * `CeRulesPage` under the complexity budget. */
function RulesBody({ report, loading, error, run }: RulesState) {
  if (error) return <p className="text-[var(--color-danger)]">Could not load the validation report.</p>;
  if (loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  if (report?.pending) {
    // ONB-V1-TASK-004: same two CE anchor ids as the results branch below,
    // planted here too -- exactly one branch is ever in the DOM, so the
    // tour resolves whichever is live. Keeps the rules-policies tour usable
    // on a first/never-run visit instead of silently no-op'ing (AC-004-02).
    return (
      <div data-tour-id="ce.rules.shape-list" className="flex items-center gap-[var(--space-3)]">
        <p data-testid="rules-pending" data-tour-id="ce.rules.violation-report" className="text-[var(--color-text-muted)]">
          No validation run yet for the current draft.
        </p>
        <Button onClick={() => void run()}>Run validation</Button>
      </div>
    );
  }
  if (!report) return null;
  return <RulesTable rules={report.rules} results={report.results} />;
}

/** Rules & Policies (IA §2.x): CE-TASK-006's `GET /api/validate` audit
 * report -- framework + tenant SHACL shapes, every severity incl.
 * `sh:Info`, per-rule violation counts (zero-violation shapes included),
 * and a pending state that's honest about "never run yet" (AC-006-04).
 * Rules tab also owns "New rule" (G3's `NlRuleDrawer`, refreshing the report
 * via `run()` on commit); Policies tab lists `weave:Policy` individuals with
 * an attach-to-entity flow (`PoliciesSection`). */
export default function CeRulesPage() {
  const rules = useRules();
  const [tab, setTab] = useState<Tab>("rules");
  const [drawerOpen, setDrawerOpen] = useState(false);

  function onRuleCommitted(): void {
    setDrawerOpen(false);
    rules.run();
  }

  return (
    <main data-tour-id="ce.rules" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Rules & Policies
        </h1>
        <Badge variant="info">M1 — this pass</Badge>
      </div>
      <TabBar active={tab} onChange={setTab} />
      {tab === "rules" ? (
        <>
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setDrawerOpen(true)}>
              New rule
            </Button>
          </div>
          <Card>
            <CardContent>
              <RulesBody {...rules} />
            </CardContent>
          </Card>
        </>
      ) : (
        <PoliciesSection />
      )}
      <RulesTour />
      {drawerOpen && <NlRuleDrawer onClose={() => setDrawerOpen(false)} onCommitted={onRuleCommitted} />}
    </main>
  );
}
