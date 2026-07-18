import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import type { PolicyRow } from "./policies-query";

interface PolicyCardsProps {
  rows: PolicyRow[];
  onAttach: (row: PolicyRow) => void;
}

/** Policies tab's card grid (task brief: "policies tab cards"), same shape
 * as brand/standards-cards.tsx. Attach opens the entity-picker flow owned by
 * the caller -- this component is purely presentational. */
export function PolicyCards({ rows, onAttach }: PolicyCardsProps) {
  if (rows.length === 0) {
    return <p className="text-[var(--color-text-muted)]">No policies yet.</p>;
  }
  return (
    <div data-testid="policy-cards" className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
      {rows.map((row) => (
        <Card key={row.iri} className="flex items-center justify-between gap-[var(--space-2)]">
          <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {row.label}
          </p>
          <Button variant="secondary" onClick={() => onAttach(row)}>
            Attach
          </Button>
        </Card>
      ))}
    </div>
  );
}
