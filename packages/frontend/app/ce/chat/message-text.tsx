import type { ReactNode } from "react";

// TASK-006 AC-006-15: an entity IRI in an AI message is a clickable link to
// CE-READ-1's resource lookup (via the session-authenticated proxy).
const IRI_PATTERN = /(urn:[^\s.,)]+|https?:\/\/[^\s.,)]+)/g;

/** Splits `text` on embedded IRIs/URLs and renders each as a link to
 * `/api/ontology/resource/{iri}` -- real slashes stay real path segments
 * (matches the `[...iri]` catch-all proxy route), no percent-encoding of
 * the whole IRI is needed for the browser-facing href.
 */
export function MessageText({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(IRI_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const iri = match[0];
    parts.push(
      <a
        key={key++}
        href={`/api/ontology/resource/${iri}`}
        className="underline text-[var(--color-accent-primary)]"
      >
        {iri}
      </a>
    );
    lastIndex = start + iri.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
