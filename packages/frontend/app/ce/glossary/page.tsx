"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GlossaryBrowseRow, GlossaryTermRow } from "@/lib/glossary/types";

import { ChatPanel } from "../chat/chat-panel";
import { GlossaryCreateForm } from "./glossary-create-form";
import { GlossaryRow } from "./glossary-row";
import { useGlossaryBrowse } from "./use-glossary-browse";
import { useGlossarySearch } from "./use-glossary-search";

function labelsByIri(rows: GlossaryBrowseRow[]): Map<string, string> {
  return new Map(rows.map((row) => [row.iri, row.prefLabel]));
}

function SearchResultRow({ term }: { term: GlossaryTermRow }) {
  return (
    <li className="flex items-center gap-[var(--space-2)] p-[var(--space-2)]">
      <span className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {term.prefLabel}
      </span>
      {term.isOwlClass && <Badge variant="info">also class</Badge>}
    </li>
  );
}

/** AC-002-01/-02: search box + on-demand results; a zero-result search opens
 * the create-term empty-state (`emptyState(q) -> CreateTermForm(prefill=q)`,
 * TASK-002 pseudocode). */
function SearchSection({
  search,
  onCreated,
}: {
  search: ReturnType<typeof useGlossarySearch>;
  onCreated: (iri: string) => void;
}) {
  const showEmptyState = search.searched && search.results.length === 0;

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          search.search();
        }}
        className="flex items-end gap-[var(--space-2)]"
      >
        <div className="flex flex-1 flex-col gap-[var(--space-1)]">
          <label htmlFor="glossary-search" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
            Search glossary
          </label>
          <Input
            id="glossary-search"
            value={search.query}
            onChange={(event) => search.setQuery(event.target.value)}
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {search.searched && search.results.length > 0 && (
        <ul data-testid="glossary-search-results" className="flex flex-col gap-[var(--space-1)]">
          {search.results.map((term) => (
            <SearchResultRow key={term.iri} term={term} />
          ))}
        </ul>
      )}

      {showEmptyState && (
        <div data-testid="glossary-empty-state" className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[var(--color-text-muted)]">
            No terms matched &ldquo;{search.query}&rdquo;. Create it below.
          </p>
          <GlossaryCreateForm prefill={search.query} onCreated={onCreated} />
        </div>
      )}
    </div>
  );
}

/** AC-002-03: 50-row browse page, ordered by prefLabel; broader/narrower
 * chips call `onNavigate` to highlight (`aria-current`) the target row. */
function BrowseSection({
  browse,
  labelByIri,
  highlightedIri,
  onNavigate,
}: {
  browse: ReturnType<typeof useGlossaryBrowse>;
  labelByIri: Map<string, string>;
  highlightedIri: string | null;
  onNavigate: (iri: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <ul data-testid="glossary-browse-list" className="flex flex-col gap-[var(--space-1)]">
        {browse.rows.map((row) => (
          <GlossaryRow
            key={row.iri}
            term={row}
            labelByIri={labelByIri}
            highlighted={row.iri === highlightedIri}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
      <div className="flex gap-[var(--space-2)]">
        <Button type="button" variant="secondary" onClick={browse.prevPage} disabled={browse.page === 1}>
          Previous
        </Button>
        <Button type="button" variant="secondary" onClick={browse.nextPage}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** AC-002-02: owns the "created" confirmation + refresh so a create-term
 * submit (from either the empty-state form or the chat surface) shows up in
 * the browse list without a full page reload. */
function useGlossaryPageState() {
  const search = useGlossarySearch();
  const browse = useGlossaryBrowse();
  const [highlightedIri, setHighlightedIri] = useState<string | null>(null);
  const [createdMessage, setCreatedMessage] = useState<string | null>(null);

  const handleCreated = (iri: string) => {
    setCreatedMessage(`Created ${iri}`);
    browse.reload();
  };

  return { search, browse, highlightedIri, setHighlightedIri, createdMessage, handleCreated };
}

/** TASK-002 (EPIC-003 E3-S3 + E3-S1): glossary search/browse plus the
 * no-match create-term path, sharing the CE-WRITE-1 op batch with the
 * persistent chat surface (AC-002-05 keeps the form path live on a chat
 * 503). */
export default function GlossaryPage() {
  const { search, browse, highlightedIri, setHighlightedIri, createdMessage, handleCreated } =
    useGlossaryPageState();

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Glossary
      </h1>

      <div className="grid flex-1 grid-cols-1 gap-[var(--space-4)] md:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-[var(--space-4)]">
          <SearchSection search={search} onCreated={handleCreated} />
          {createdMessage && <p role="status">{createdMessage}</p>}
          <BrowseSection
            browse={browse}
            labelByIri={labelsByIri(browse.rows)}
            highlightedIri={highlightedIri}
            onNavigate={setHighlightedIri}
          />
        </div>
        <ChatPanel />
      </div>
    </main>
  );
}
