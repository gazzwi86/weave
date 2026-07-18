"use client";

import { useState } from "react";

import { ExpandableDataTable, type DataTableColumn, type DataTableRow } from "@/components/templates/ExpandableDataTable";

import { SeverityBadge } from "./severity-badge";
import type { RuleCoverage, ValidationResultEntry } from "./types";

const COLUMNS: DataTableColumn[] = [
  { key: "rule", label: "Rule" },
  { key: "constraint", label: "Constraint" },
  { key: "target", label: "Target" },
  { key: "severity", label: "Severity" },
  { key: "violations", label: "Violations" },
];

/** Local name of an IRI (`urn:weave:shapes:ProcessOwnerShape` -> the last
 * `#`/`/`/`:`-separated segment) -- shapes and BPMO kinds are both URN-style
 * here, unlike `lib/instances/kind-slug.ts`'s hash/slash-only IRIs. */
function localName(iri: string): string {
  const cut = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"), iri.lastIndexOf(":"));
  return iri.slice(cut + 1);
}

function ViolationDetail({ entries }: { entries: ValidationResultEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">No violations.</p>;
  }
  return (
    <ul className="flex flex-col gap-[var(--space-3)]">
      {entries.map((entry) => (
        <li key={`${entry.focus_node}-${entry.path ?? ""}`} className="flex flex-col gap-[var(--space-1)]">
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{entry.message}</p>
          <p className="font-[var(--font-mono)] text-[length:var(--text-mono-sm)] text-[var(--color-text-subtle)]">
            <span>{entry.focus_node}</span>
            {entry.path ? <span> · {localName(entry.path)}</span> : null}
          </p>
          <a
            href={`/explorer?focus=${encodeURIComponent(entry.focus_node)}`}
            className="text-[length:var(--text-caption)] text-[var(--color-info)] underline"
          >
            Open instance
          </a>
        </li>
      ))}
    </ul>
  );
}

function ruleRow(rule: RuleCoverage, isFirst: boolean): DataTableRow {
  return {
    id: rule.shape_iri,
    cells: {
      rule: (
        <div data-tour-id={isFirst ? "ce.rules.violation-report" : undefined}>
          <b className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {localName(rule.shape_iri)}
          </b>
          <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">{rule.description}</p>
        </div>
      ),
      // G1: constraint_summary is the formal SHACL constraint (e.g. "sh:minCount 1
      // on weave:hasOwner"); description (above) is the human-authored prose.
      constraint: rule.constraint_summary ?? "—",
      target: rule.target_class ? localName(rule.target_class) : "—",
      severity: <SeverityBadge severity={rule.severity} />,
      violations: rule.violation_count,
    },
  };
}

interface RulesTableProps {
  rules: RuleCoverage[];
  results: ValidationResultEntry[];
}

/** AC-006-03/-05: one row per modelled shape (framework + tenant, incl.
 * zero-violation shapes), expandable to the violating entities for that
 * shape -- collapsed by default (refit-mock.html's `.viol-row`, `onclick`
 * toggle), rather than always-inline like the pre-refit list. */
export function RulesTable({ rules, results }: RulesTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const resultsByShape = (shapeIri: string) => results.filter((entry) => entry.shape_iri === shapeIri);

  return (
    <div data-testid="rule-list" data-tour-id="ce.rules.shape-list">
      <ExpandableDataTable
        columns={COLUMNS}
        rows={rules.map((rule, index) => ruleRow(rule, index === 0))}
        expandable={{
          expandedRowId,
          onToggleRow: (id) => setExpandedRowId((current) => (current === id ? null : id)),
          renderDetail: (row) => <ViolationDetail entries={resultsByShape(row.id)} />,
        }}
      />
    </div>
  );
}
