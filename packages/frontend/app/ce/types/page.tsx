"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

import type { KindEntry, PropertyShape } from "../chat/types";
import { kindId, useTypes } from "./use-types";

/** SHACL cardinality as a compact range: absent min → 0, absent max → *. */
function cardinality(prop: PropertyShape): string {
  return `${prop.min_count ?? 0}..${prop.max_count ?? "*"}`;
}

/** Singular/plural noun for a count -- e.g. "1 property" / "2 properties". */
function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ShapeList({ heading, shapes }: { heading: string; shapes: PropertyShape[] }) {
  if (shapes.length === 0) {
    return null;
  }
  return (
    <div>
      <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {heading}
      </p>
      <ul className="flex flex-col gap-[var(--space-1)]">
        {shapes.map((prop) => (
          <li key={prop.path} className="flex items-baseline gap-[var(--space-3)]">
            <span className="text-[var(--color-text-default)]">{prop.name}</span>
            <span className="font-mono text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)]">
              {cardinality(prop)} · {prop.path}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KindDetail({ kind }: { kind: KindEntry }) {
  const properties = kind.properties.filter((prop) => !prop.is_relationship);
  const relationships = kind.properties.filter((prop) => prop.is_relationship);

  return (
    <div
      data-testid={`kind-detail-${kindId(kind.iri)}`}
      className="flex flex-col gap-[var(--space-3)] border-l-2 border-[var(--color-border)] pt-[var(--space-2)] pb-[var(--space-2)] pl-[var(--space-4)]"
    >
      <p className="font-mono text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)]">
        {kind.iri}
      </p>
      {kind.properties.length === 0 && (
        <p className="text-[var(--color-text-muted)]">No property shapes declared.</p>
      )}
      <ShapeList heading="Properties" shapes={properties} />
      <ShapeList heading="Relationships" shapes={relationships} />
      <p className="text-[var(--color-text-muted)]">
        Framework kind — view-only in M1; extensions land later.
      </p>
    </div>
  );
}

interface KindRowProps {
  kind: KindEntry;
  colour: string;
  expanded: boolean;
  onToggle: () => void;
}

function KindRow({ kind, colour, expanded, onToggle }: KindRowProps) {
  const properties = kind.properties.filter((prop) => !prop.is_relationship).length;
  const relationships = kind.properties.length - properties;

  return (
    <li className="border-b border-[var(--color-border)] pb-[var(--space-2)]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        data-testid={`kind-row-${kindId(kind.iri)}`}
        className="flex w-full items-baseline gap-[var(--space-3)] text-left"
      >
        <span
          aria-hidden
          className="h-[var(--space-2)] w-[var(--space-2)] shrink-0 self-center rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span className="flex flex-col">
          <span className="font-[var(--font-weight-medium)] text-[var(--color-text-default)]">
            {kind.label}
          </span>
          {kind.description && (
            <span
              data-testid={`kind-row-description-${kindId(kind.iri)}`}
              className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]"
            >
              {kind.description}
            </span>
          )}
        </span>
        <span className="ml-auto text-[var(--color-text-muted)]">
          {countLabel(properties, "property", "properties")} ·{" "}
          {countLabel(relationships, "relationship", "relationships")}
        </span>
      </button>
      {expanded && <KindDetail kind={kind} />}
    </li>
  );
}

/** Ontology / Types (IA §2.1): the BPMO kinds served by the authoritative
 * GET /api/ontology/types (CE-READ-1) — never a hand-copied list. View-only
 * browse in M1; clicking a kind expands its property/relationship shapes
 * inline. Each row shows the kind's skos:definition description (TASK-011)
 * when the backend provides one; extension kinds without one render no
 * secondary line.
 */
export default function CeTypesPage() {
  const { kinds, colourByKindId, loading, loadError } = useTypes();
  const [expandedIri, setExpandedIri] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Ontology / Types
      </h1>
      <Card>
        <CardContent>
          {loading && <p className="text-[var(--color-text-muted)]">Loading kinds…</p>}
          {loadError && (
            <p data-testid="types-error" className="text-[var(--color-text-muted)]">
              Unable to load the kind catalogue from the backend.
            </p>
          )}
          {!loading && !loadError && (
            <ul data-testid="kind-list" className="flex flex-col gap-[var(--space-2)]">
              {kinds.map((kind) => (
                <KindRow
                  key={kind.iri}
                  kind={kind}
                  colour={colourByKindId[kindId(kind.iri)] ?? "var(--color-kind-fallback)"}
                  expanded={expandedIri === kind.iri}
                  onToggle={() => setExpandedIri(expandedIri === kind.iri ? null : kind.iri)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
