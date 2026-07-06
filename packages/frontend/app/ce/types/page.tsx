"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useKindList } from "../use-kind-list";

/** Ontology / Types (IA §2.1): the BPMO kinds served by the authoritative
 * GET /api/ontology/types (CE-READ-1) — never a hand-copied list. Thin
 * browse view; kind editing arrives with CE-EPIC-001. */
export default function CeTypesPage() {
  const kinds = useKindList();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Ontology / Types
        </h1>
        <Badge variant="info">M1 — this pass</Badge>
      </div>
      <Card>
        <CardContent>
          {kinds.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">Loading kinds…</p>
          ) : (
            <ul data-testid="kind-list" className="flex flex-col gap-[var(--space-2)]">
              {kinds.map((kind) => (
                <li
                  key={kind.iri}
                  className="flex items-baseline justify-between gap-[var(--space-3)] border-b border-[var(--color-border)] pb-[var(--space-2)]"
                >
                  <span className="font-[var(--font-weight-medium)] text-[var(--color-text-default)]">
                    {kind.label}
                  </span>
                  <span className="font-mono text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)]">
                    {kind.iri}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
