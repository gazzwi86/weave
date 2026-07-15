"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { RuleRow } from "./rule-row";
import { RulesTour } from "./rules-tour";
import type { RulesState } from "./use-rules";
import { useRules } from "./use-rules";

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
  return (
    <ul data-testid="rule-list" data-tour-id="ce.rules.shape-list" className="flex flex-col">
      {report.rules.map((rule, index) => (
        <RuleRow
          key={rule.shape_iri}
          rule={rule}
          violatingEntities={report.results.filter((entry) => entry.shape_iri === rule.shape_iri)}
          isFirst={index === 0}
        />
      ))}
    </ul>
  );
}

/** Rules & Policies (IA §2.x): CE-TASK-006's `GET /api/validate` audit
 * report -- framework + tenant SHACL shapes, every severity incl.
 * `sh:Info`, per-rule violation counts (zero-violation shapes included),
 * and a pending state that's honest about "never run yet" (AC-006-04). */
export default function CeRulesPage() {
  const rules = useRules();

  return (
    <main data-tour-id="ce.rules" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Rules & Policies
        </h1>
        <Badge variant="info">M1 — this pass</Badge>
      </div>
      <Card>
        <CardContent>
          <RulesBody {...rules} />
        </CardContent>
      </Card>
      <RulesTour />
    </main>
  );
}
