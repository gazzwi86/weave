import { Badge } from "@/components/ui/badge";
import type { GlossaryBrowseRow } from "@/lib/glossary/types";

const DEFINITION_SNIPPET_LENGTH = 140;

/** Pitfall (TASK-002): definitions can be long -- truncated client-side
 * after fetch rather than fetching a `SUBSTR`-clipped value from SPARQL,
 * since the list only ever shows a short snippet. */
function truncate(text: string | null): string {
  if (!text) return "";
  return text.length > DEFINITION_SNIPPET_LENGTH ? `${text.slice(0, DEFINITION_SNIPPET_LENGTH)}…` : text;
}

function chipLabel(iri: string, labelByIri: Map<string, string>): string {
  return labelByIri.get(iri) ?? iri.split(/[/#]/).pop() ?? iri;
}

function RelationChips({
  iris,
  labelByIri,
  onNavigate,
}: {
  iris: string[];
  labelByIri: Map<string, string>;
  onNavigate: (iri: string) => void;
}) {
  if (iris.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-[var(--space-1)]">
      {iris.map((iri) => (
        <button
          key={iri}
          type="button"
          onClick={() => onNavigate(iri)}
          className="text-[length:var(--text-caption)] text-[var(--color-accent-primary)] underline"
        >
          {chipLabel(iri, labelByIri)}
        </button>
      ))}
    </div>
  );
}

/** AC-002-03: one browse row -- prefLabel, the punned-typing "also class"
 * chip (never colour-alone, WCAG 1.4.1: text label always present), and
 * clickable broader/narrower chips that drive AC-002-03's E2E navigation. */
export function GlossaryRow({
  term,
  labelByIri,
  highlighted,
  onNavigate,
}: {
  term: GlossaryBrowseRow;
  labelByIri: Map<string, string>;
  highlighted: boolean;
  onNavigate: (iri: string) => void;
}) {
  return (
    <li
      data-testid={`glossary-row-${term.iri}`}
      aria-current={highlighted ? "true" : undefined}
      className={
        highlighted
          ? "flex flex-col gap-[var(--space-1)] rounded-[var(--radius-base)] bg-[var(--color-hover)] p-[var(--space-2)]"
          : "flex flex-col gap-[var(--space-1)] p-[var(--space-2)]"
      }
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">{term.prefLabel}</span>
        {term.isOwlClass && <Badge variant="info">also class</Badge>}
      </div>
      {term.definition && <p className="text-[var(--color-text-muted)]">{truncate(term.definition)}</p>}
      <RelationChips iris={term.broaderIris} labelByIri={labelByIri} onNavigate={onNavigate} />
      <RelationChips iris={term.narrowerIris} labelByIri={labelByIri} onNavigate={onNavigate} />
    </li>
  );
}
