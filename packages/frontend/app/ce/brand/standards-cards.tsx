import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { Attribution, BrandStandardRow } from "./types";

interface StandardsCardsProps {
  rows: BrandStandardRow[];
  onEdit: (row: BrandStandardRow) => void;
  /** AC-004-03: per-row PROV-O attribution -- omitted callers get no
   * attribution line (the create-form success message already covers it). */
  attributionFor?: (iri: string) => Attribution | null;
}

/** Standards tab (remediation-2 lane): policy-card grid, one card per
 * standard -- distinct from the brand-rules DataTable since a standard's
 * content is prose (a name + body/source + effective metadata), not a
 * short structured row. Edit routes to `StandardEditDrawer`.
 */
export function StandardsCards({ rows, onEdit, attributionFor }: StandardsCardsProps) {
  if (rows.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No standards yet.</p>;
  }
  return (
    <div data-testid="standard-cards" className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
      {rows.map((row) => {
        const attribution = attributionFor?.(row.iri) ?? null;
        return (
          <Card key={row.iri} className="flex flex-col gap-[var(--space-2)]">
            {/* Plain text, not CardTitle -- same heading-order trap ce/brand/page.tsx documents. */}
            <div className="flex items-start justify-between gap-[var(--space-2)]">
              <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
                {row.contentType}
              </p>
              <Button variant="secondary" onClick={() => onEdit(row)}>
                Edit
              </Button>
            </div>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
              {row.contentBody ?? row.sourceUri ?? "—"}
            </p>
            <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
              Effective {row.effectiveDate} · Owner: {row.owner}
              {attribution ? ` · Last edit: ${attribution.actorIri}` : ""}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
