import type { ReactNode } from "react";

// TASK-006 AC-006-15: an entity IRI in an AI message is a clickable link.
// Dots are legal mid-IRI (weave.io) -- match them, then trim trailing
// sentence punctuation off the captured IRI below.
const IRI_PATTERN = /(urn:[^\s,)]+|https?:\/\/[^\s,)]+)/g;

/** Splits `text` on embedded IRIs/URLs and renders each as a link into the
 * Graph Explorer (`/explorer?focus={iri}`), which centers and spotlights
 * the entity -- a raw `/api/ontology/resource` JSON dump is the wrong
 * destination for a person clicking an entity.
 */
export function MessageText({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(IRI_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    // Trim trailing sentence punctuation (`.`/`:`) off the IRI with a linear
    // scan -- a `/[.:]+$/` regex trips the ReDoS linter.
    const raw = match[0];
    let end = raw.length;
    while (end > 0 && (raw[end - 1] === "." || raw[end - 1] === ":")) end--;
    const iri = raw.slice(0, end);
    parts.push(
      <a
        key={key++}
        href={`/explorer?focus=${encodeURIComponent(iri)}`}
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
