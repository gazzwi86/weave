"use client";

import { useState } from "react";

import type { KindEntry } from "../chat/types";
import { AuthoringDrawer } from "./authoring-drawer";
import { ChatAside } from "./chat-aside";
import { PAGE_SIZE } from "./build-browse-query";
import { useInspector, type InspectedResource } from "./use-inspector";
import { useInstanceBrowser } from "./use-instance-browser";
import type { InstanceRow } from "./types";
import { kindIriToSlug } from "@/lib/instances/kind-slug";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import type { FilterChip } from "@/components/ui/filter-bar";
import { InstancesBrowsePage, type InstanceRowView } from "@/components/templates/InstanceBrowserPage";

function kindLabelFor(kindIri: string, kinds: KindEntry[]): string {
  return kinds.find((kind) => kind.iri === kindIri)?.label ?? kindIri;
}

function buildKindChips(kinds: KindEntry[]): FilterChip[] {
  return [
    { id: "all", label: "All" },
    ...kinds.map((kind) => ({
      id: kind.iri,
      label: kind.label,
      color: `var(--color-kind-${kindIriToSlug(kind.iri)})`,
    })),
  ];
}

// "All" clears whatever kind is active rather than being a filterable id of
// its own -- clicking it again while nothing is filtered is a no-op.
function toggleKindChip(id: string, activeKindFilter: string | null, toggleKindFilter: (iri: string) => void): void {
  if (id === "all") {
    if (activeKindFilter) toggleKindFilter(activeKindFilter);
    return;
  }
  toggleKindFilter(id);
}

function toRowView(row: InstanceRow, kinds: KindEntry[]): InstanceRowView {
  return {
    iri: row.iri,
    label: row.label,
    kindSlug: kindIriToSlug(row.kindIri),
    kindLabel: kindLabelFor(row.kindIri, kinds),
  };
}

// No COUNT query backs the browse endpoint (build-browse-query.ts selects
// only ?iri ?label ?kind), so the true total is unknown -- a has-more
// heuristic off the current page's row count, not a fabricated total.
function paginationRangeLabel(page: number, rowCount: number): string {
  if (rowCount === 0) return "No results";
  const start = (page - 1) * PAGE_SIZE + 1;
  return `Showing ${start}–${start + rowCount - 1}`;
}

/** AC-4: "view on canvas" carries the focus IRI as a deep link into the
 * Explorer (a separate engine surface -- this task only builds the link).
 */
function ViewOnCanvasLink({ iri }: { iri: string }) {
  return (
    <a href={`/explorer?focus=${encodeURIComponent(iri)}`} className="text-[var(--color-accent-primary)] underline">
      View on canvas
    </a>
  );
}

function InspectorActions({ iri, onEdit }: { iri: string; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <Button type="button" variant="secondary" onClick={onEdit}>
        Edit
      </Button>
      <ViewOnCanvasLink iri={iri} />
    </div>
  );
}

/** Create-flow kind chooser: a native select over the CE-READ-1 kind
 * catalogue, so a business analyst picks which kind to create instead of
 * being locked to whichever sorts first (the R1 cert bug). */
function KindPicker({ kinds, onPick, onClose }: { kinds: KindEntry[]; onPick: (kind: KindEntry) => void; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-4)]">
      <label htmlFor="add-kind" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        Kind
      </label>
      <select
        id="add-kind"
        aria-label="Kind"
        defaultValue=""
        onChange={(event) => {
          const kind = kinds.find((k) => k.iri === event.target.value);
          if (kind) onPick(kind);
        }}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      >
        <option value="" disabled>
          Choose a kind…
        </option>
        {kinds.map((kind) => (
          <option key={kind.iri} value={kind.iri}>
            {kind.label}
          </option>
        ))}
      </select>
      <div>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function buildInspectorProps(resource: InspectedResource | null, loading: boolean, onEdit: () => void) {
  if (!resource) return null;
  return {
    title: resource.label,
    fields: resource.properties.map((p) => ({ label: p.label, value: p.value })),
    edges: resource.edges.map((e) => ({ label: e.label, value: e.value })),
    history: "unavailable" as const,
    actions: <InspectorActions iri={resource.iri} onEdit={onEdit} />,
    loading,
  };
}

function PageEyebrowHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-4)]">
      <div>
        <p className="text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] text-[var(--color-accent-primary)]">
          Constitution
        </p>
        <h1 className="text-[length:var(--text-h1)] font-[var(--font-weight-bold)] text-[var(--color-text-default)]">
          Instances / Data
          <InfoTip
            title="Instances"
            body={
              "An instance is one real thing of a kind — “Order handling” is an instance of Process. " +
              "Each gets a permanent identifier (IRI), so links to it never break even if it is renamed."
            }
          />
        </h1>
        <p className="mt-[var(--space-1)] text-[length:var(--text-body)] text-[var(--color-text-muted)]">
          Every entity in the model — filter by kind, inspect, and jump to the canvas.
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={onAdd}>
        New instance
      </Button>
    </div>
  );
}

/** The browse table + inspector, once neither drawer is open -- split out
 * of `InstancesPage` to keep it under the complexity/line budget (Law E). */
function InstancesBrowseScreen({
  browser,
  selectedIri,
  onSelectRow,
  selectedRow,
  inspectorProps,
  onAdd,
}: {
  browser: ReturnType<typeof useInstanceBrowser>;
  selectedIri: string | null;
  onSelectRow: (iri: string) => void;
  selectedRow: InstanceRow | undefined;
  inspectorProps: ReturnType<typeof buildInspectorProps>;
  onAdd: () => void;
}) {
  const activeChipIds = browser.activeKindFilter ? [browser.activeKindFilter] : ["all"];
  const rowCount = browser.rows.length;

  return (
    <main data-tour-id="ce.instances" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <PageEyebrowHeader onAdd={onAdd} />
      <InstancesBrowsePage
        rows={browser.rows.map((row) => toRowView(row, browser.kinds))}
        loading={browser.loading}
        errorMessage={browser.errorMessage}
        selectedRowId={selectedIri ?? undefined}
        onSelectRow={onSelectRow}
        pagination={{
          page: browser.page,
          pageCount: rowCount === PAGE_SIZE ? browser.page + 1 : browser.page,
          rangeLabel: paginationRangeLabel(browser.page, rowCount),
          onPageChange: browser.setPage,
        }}
        kindChips={buildKindChips(browser.kinds)}
        activeChipIds={activeChipIds}
        onToggleChip={(id) => toggleKindChip(id, browser.activeKindFilter, browser.toggleKindFilter)}
        search={{ value: browser.searchTerm, onChange: browser.setSearchTerm, label: "Search instances", placeholder: "Search instances…" }}
        filterTrailing={<span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Status: any</span>}
        inspector={inspectorProps}
        inspectorKind={selectedRow ? { slug: kindIriToSlug(selectedRow.kindIri), label: kindLabelFor(selectedRow.kindIri, browser.kinds) } : null}
        asideExtra={<ChatAside />}
      />
    </main>
  );
}

/** AC-1..AC-7: container -- binds `useInstanceBrowser`/`useInspector` data
 * to `InstancesBrowsePage` (refit-mock.html `#sub-instances`: FilterBar +
 * DataTable + Pagination + InspectorPanel); the guided `AuthoringDrawer`
 * opens for create (via `KindPicker` -> chosen kind) and edit (row-inspector
 * "Edit" action). Both get SHACL fields + relationship entity-pickers from
 * the drawer.
 */
export default function InstancesPage() {
  const browser = useInstanceBrowser();
  const [selectedIri, setSelectedIri] = useState<string | null>(null);
  const { resource, loading: inspectorLoading } = useInspector(selectedIri);
  const [drawerShape, setDrawerShape] = useState<KindEntry | null>(null);
  const [addingKind, setAddingKind] = useState(false);

  const selectedRow = browser.rows.find((row) => row.iri === selectedIri);
  const selectedKind = browser.kinds.find((kind) => kind.iri === selectedRow?.kindIri) ?? null;

  const closeDrawer = () => {
    setDrawerShape(null);
    setAddingKind(false);
  };

  // One drawer for both flows: edit binds to the selected row, create binds
  // to the kind picked below (no selectedRow). AuthoringDrawer already renders
  // relationship fields via EntityPicker, so create gets pickers for free.
  if (drawerShape) {
    return (
      <AuthoringDrawer
        shape={drawerShape}
        mode={selectedRow ? "edit" : "create"}
        targetIri={selectedRow?.iri}
        initialValues={selectedRow ? { label: selectedRow.label } : undefined}
        onClose={closeDrawer}
      />
    );
  }

  if (addingKind) {
    return <KindPicker kinds={browser.kinds} onPick={setDrawerShape} onClose={() => setAddingKind(false)} />;
  }

  return (
    <InstancesBrowseScreen
      browser={browser}
      selectedIri={selectedIri}
      onSelectRow={setSelectedIri}
      selectedRow={selectedRow}
      inspectorProps={buildInspectorProps(resource, inspectorLoading, () => selectedKind && setDrawerShape(selectedKind))}
      onAdd={() => setAddingKind(true)}
    />
  );
}
