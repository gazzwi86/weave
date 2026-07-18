import { ExpandableDataTable, type DataTableColumn, type DataTableRow } from "@/components/templates/ExpandableDataTable";
import { Button } from "@/components/ui/button";
import { SevChip } from "@/components/ui/sev-chip";

import type { Attribution, VoiceRuleRow } from "./types";

const COLUMNS: DataTableColumn[] = [
  { key: "ruleId", label: "Rule" },
  { key: "severity", label: "Severity" },
  { key: "assertion", label: "Assertion" },
  { key: "attribution", label: "Last edit" },
];

interface BrandRulesTableProps {
  rows: VoiceRuleRow[];
  onEdit: (row: VoiceRuleRow) => void;
  /** AC-004-03: per-row PROV-O attribution -- omitted callers get an empty
   * "Last edit" column (the create-form success message already covers it). */
  attributionFor?: (iri: string) => Attribution | null;
}

function ruleRow(row: VoiceRuleRow, attributionFor?: (iri: string) => Attribution | null): DataTableRow {
  const attribution = attributionFor?.(row.iri) ?? null;
  return {
    id: row.iri,
    cells: {
      ruleId: row.ruleId,
      // VoiceRuleRow.severity is already SevChip's "critical" | "normal" union.
      severity: <SevChip severity={row.severity} />,
      assertion: <span className="font-[var(--font-mono)] text-[length:var(--text-mono-sm)]">{row.assertion}</span>,
      attribution: attribution ? (
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{attribution.actorIri}</span>
      ) : null,
    },
  };
}

/** Brand rules tab (remediation-2 lane): structured-row table, unlike the
 * standards tab's prose cards -- rule id/severity/assertion fit a table
 * naturally. Edit opens `VoiceRuleEditDrawer`; delete lives inside that
 * drawer's own ConfirmDialog, not a row action (avoids a second confirm
 * surface for the same action).
 */
export function BrandRulesTable({ rows, onEdit, attributionFor }: BrandRulesTableProps) {
  if (rows.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No brand rules yet.</p>;
  }
  const rowByIri = new Map(rows.map((row) => [row.iri, row]));
  return (
    <div data-testid="brand-rules-table">
      <ExpandableDataTable
        columns={COLUMNS}
        rows={rows.map((row) => ruleRow(row, attributionFor))}
        renderRowActions={(dataRow) => {
          const row = rowByIri.get(dataRow.id);
          return row ? (
            <Button variant="secondary" onClick={() => onEdit(row)}>
              Edit
            </Button>
          ) : null;
        }}
      />
    </div>
  );
}
