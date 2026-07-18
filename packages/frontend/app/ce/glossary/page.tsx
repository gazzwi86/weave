"use client";

import { useState } from "react";

import type { DataTableRow } from "@/components/templates/FilterableTablePage";
import { FilterableTablePage } from "@/components/templates/FilterableTablePage";
import { RelationshipsEditorSlot } from "@/components/templates/RelationshipsEditorSlot";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FilterChip } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { InfoTip } from "@/components/ui/info-tip";
import { useToast } from "@/components/ui/toast";
import { createGlossaryTerm } from "@/lib/glossary/create-glossary-term";
import type { GlossaryBrowseRow } from "@/lib/glossary/types";

import { buildGlossaryRows, labelByIri, type GlossaryAlphaFilter } from "./glossary-rows";
import { deleteGlossaryTerm, updateGlossaryTerm } from "./glossary-ops";
import type { GlossaryBrowseState } from "./use-glossary-browse";
import { useGlossaryBrowse } from "./use-glossary-browse";
import type { GlossaryDrawerState } from "./use-glossary-drawer";
import { useGlossaryDrawer } from "./use-glossary-drawer";

const ALPHA_CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "a-f", label: "A–F" },
  { id: "g-m", label: "G–M" },
  { id: "n-s", label: "N–S" },
  { id: "t-z", label: "T–Z" },
];

const GLOSSARY_COLUMNS = [
  { key: "term", label: "Term" },
  { key: "definition", label: "Definition" },
  { key: "related", label: "Related" },
];

const REL_EDIT_GAP_TOAST =
  "Relationship edits aren't wired to add_edge/delete_edge yet -- the editor has no target-IRI picker for glossary terms in M1.";

function GlossaryHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Glossary
      </h1>
      <InfoTip
        title="The shared language of the business"
        body="A glossary term is a SKOS concept -- linked into the model, so it shows up on the canvas and in queries, not just as a definition."
        how="A term punned as an owl:Class (badged 'also class') can also carry its own instances."
      />
      <Button className="ml-auto" onClick={onNew}>
        <Icon name="plus" size={13} />
        New term
      </Button>
    </div>
  );
}

/** Builds the hover-reveal edit/delete actions for a row, given the loaded
 * page so a row id resolves back to its term (kept out of the page body
 * for the Law E line budget). */
function makeRowActions(rows: GlossaryBrowseRow[], onEdit: (term: GlossaryBrowseRow) => void, onDelete: (term: GlossaryBrowseRow) => void) {
  return function renderRowActions(row: DataTableRow) {
    const term = rows.find((entry) => entry.iri === row.id);
    if (!term) return null;
    return (
      <>
        <Button variant="ghost" aria-label={`Edit ${term.prefLabel}`} onClick={() => onEdit(term)}>
          <Icon name="pencil" size={13} />
        </Button>
        <Button variant="ghost" aria-label={`Delete ${term.prefLabel}`} onClick={() => onDelete(term)}>
          <Icon name="trash" size={13} />
        </Button>
      </>
    );
  };
}

function relatedCount(term: GlossaryBrowseRow): number {
  return term.broaderIris.length + term.narrowerIris.length;
}

/** refit-mock.html `#sub-glossary`'s delete-confirm copy: "Links from N
 * related item(s) will be dropped." -- 0 related items is honest rather
 * than fabricating a plural count the mock's static sample never shows. */
function deleteConsequence(term: GlossaryBrowseRow): string {
  const count = relatedCount(term);
  if (count === 0) return "This term has no related links.";
  return `Links from ${count} related item${count === 1 ? "" : "s"} will be dropped.`;
}

interface GlossaryTableArgs {
  filter: GlossaryAlphaFilter;
  search: string;
  onFilter: (id: string) => void;
  onSearch: (value: string) => void;
  pageRows: DataTableRow[];
  browse: GlossaryBrowseState;
  rowActions: ReturnType<typeof makeRowActions>;
  drawerProps: ReturnType<typeof buildDrawerProps>;
}

/** Assembles the full `FilterableTablePage` prop set (kept out of the page
 * body for the Law E line budget). `pageCount` is a next-page heuristic,
 * not a real total -- see `glossary-rows.ts`'s module doc for why no
 * corpus-wide count exists. */
function buildGlossaryTableProps(args: GlossaryTableArgs) {
  const { filter, search, onFilter, onSearch, pageRows, browse, rowActions, drawerProps } = args;
  const hasMore = browse.rows.length >= 50;
  return {
    filterBar: {
      chips: ALPHA_CHIPS,
      activeIds: [filter],
      onToggle: onFilter,
      search: { value: search, onChange: onSearch, label: "Search terms", placeholder: "Search terms on this page…" },
    },
    columns: GLOSSARY_COLUMNS,
    rows: pageRows,
    loading: browse.loading,
    renderRowActions: rowActions,
    pagination: {
      page: browse.page,
      pageCount: hasMore ? browse.page + 1 : browse.page,
      rangeLabel:
        pageRows.length === browse.rows.length
          ? `Showing ${browse.rows.length} terms`
          : `Showing ${pageRows.length} of ${browse.rows.length} loaded terms`,
      onPageChange: (page: number) => (page > browse.page ? browse.nextPage() : browse.prevPage()),
    },
    error: browse.error
      ? { title: "Couldn't load the glossary", body: "The glossary browse endpoint didn't respond.", onRetry: browse.reload }
      : undefined,
    drawer: drawerProps,
  };
}

/** Maps drawer draft state onto `EntityEditDrawer` props (kept out of the
 * page body for the Law E line budget). */
function buildDrawerProps(drawer: GlossaryDrawerState, onSave: () => void, onDeleteRequest: (term: GlossaryBrowseRow) => void) {
  return {
    open: drawer.open,
    onClose: drawer.close,
    onSave,
    onDelete: drawer.term ? () => onDeleteRequest(drawer.term!) : undefined,
    icon: "book" as const,
    tone: "var(--color-accent-primary)",
    title: drawer.term ? `Edit term — ${drawer.term.prefLabel}` : "New term",
    label: drawer.label,
    onLabelChange: drawer.setLabel,
    description: drawer.definition,
    onDescriptionChange: drawer.setDefinition,
    relationships: <RelationshipsEditorSlot rels={drawer.rels} onAdd={drawer.addRel} onRemove={drawer.removeRel} hideLabel />,
  };
}

/** Resolves the drawer save button to a real CE-WRITE-1 op: `add_node`
 * (existing `createGlossaryTerm`) for a new term, `update_node` for an
 * edit -- unlike the Types page, a glossary term is a plain graph node so
 * both ops apply directly, no shape-mutation gap. A changed relationships
 * draft still gets a gap toast (see `REL_EDIT_GAP_TOAST`). */
async function saveGlossaryTerm(
  drawer: GlossaryDrawerState,
  toast: ReturnType<typeof useToast>["toast"],
  reload: () => void
): Promise<void> {
  const input = { prefLabel: drawer.label, lang: "en", definition: drawer.definition };
  const result = drawer.term ? await updateGlossaryTerm(drawer.term.iri, input) : await createGlossaryTerm(input);

  if (result.type === "ok") {
    toast({ message: drawer.term ? `Saved changes to "${drawer.label}".` : `Created "${drawer.label}".`, variant: "success" });
    reload();
    drawer.close();
  } else if (result.type === "violations") {
    toast({ message: Object.values(result.errors).join(" "), variant: "error" });
  } else {
    toast({ message: drawer.term ? "Could not save the term." : "Could not create the term.", variant: "error" });
  }

  if (drawer.relsChanged) {
    toast({ message: REL_EDIT_GAP_TOAST, variant: "info" });
  }
}

/** Glossary (IA `#sub-glossary`): the shared-language SKOS term catalogue,
 * refit onto the `FilterableTablePage` template. Browse is a single
 * server-paged 50-row CE-READ-1 SPARQL query (see `glossary-rows.ts`), so
 * the alphabetic/search filters and the pagination range label are both
 * honestly scoped to the currently loaded page, not the whole corpus.
 * `lib/glossary/*` stays untouched; edit/delete/create wire real
 * CE-WRITE-1 ops (`glossary-ops.ts`), only relationship-chip persistence
 * is gap-toasted. Page stays data-binding only: filtering/row-shaping in
 * `glossary-rows.tsx`, drawer draft state in `use-glossary-drawer.ts`.
 */
export default function GlossaryPage() {
  const browse = useGlossaryBrowse();
  const drawer = useGlossaryDrawer();
  const { toast } = useToast();
  const [filter, setFilter] = useState<GlossaryAlphaFilter>("all");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<GlossaryBrowseRow | null>(null);

  const pageRows = buildGlossaryRows(browse.rows, filter, search);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const result = await deleteGlossaryTerm(pendingDelete.iri);
    if (result.type === "ok") {
      toast({ message: `Deleted "${pendingDelete.prefLabel}".`, variant: "success" });
      browse.reload();
    } else {
      toast({ message: "Could not delete the term.", variant: "error" });
    }
    setPendingDelete(null);
    drawer.close();
  };

  const tableProps = buildGlossaryTableProps({
    filter,
    search,
    onFilter: (id) => setFilter(id as GlossaryAlphaFilter),
    onSearch: setSearch,
    pageRows,
    browse,
    rowActions: makeRowActions(browse.rows, (term) => drawer.openEdit(term, labelByIri(browse.rows)), setPendingDelete),
    drawerProps: buildDrawerProps(drawer, () => void saveGlossaryTerm(drawer, toast, browse.reload), setPendingDelete),
  });

  return (
    <main data-tour-id="ce.glossary" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <GlossaryHeader onNew={drawer.openNew} />
      <FilterableTablePage {...tableProps} />
      {pendingDelete && (
        <ConfirmDialog
          open
          entityType="term"
          entityName={pendingDelete.prefLabel}
          consequence={deleteConsequence(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
    </main>
  );
}
