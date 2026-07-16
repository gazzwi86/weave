"use client";

import { useState } from "react";

import type { KindEntry } from "../chat/types";
import { AuthoringDrawer } from "./authoring-drawer";
import { ChatAside } from "./chat-aside";
import { useInspector, type InspectedResource } from "./use-inspector";
import { useInstanceBrowser } from "./use-instance-browser";
import { kindIriToSlug } from "@/lib/instances/kind-slug";
import { Button } from "@/components/ui/button";
import {
  InstanceBrowserPage,
  KindCell,
  type DataTableColumn,
  type DataTableRow,
  type KindFilterOption,
} from "@/components/templates/InstanceBrowserPage";

const COLUMNS: DataTableColumn[] = [
  { key: "kind", label: "Kind" },
  { key: "label", label: "Label" },
];

function buildKindOptions(kinds: KindEntry[]): KindFilterOption[] {
  return kinds.map((kind) => ({ iri: kind.iri, label: kind.label, slug: kindIriToSlug(kind.iri) }));
}

function buildRows(rows: { iri: string; label: string; kindIri: string }[]): DataTableRow[] {
  return rows.map((row) => ({
    id: row.iri,
    cells: { kind: <KindCell kind={kindIriToSlug(row.kindIri)} />, label: row.label },
  }));
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

/** AC-1..AC-7: container -- binds `useInstanceBrowser`/`useInspector` data
 * to the presentational `InstanceBrowserPage` template; the guided
 * `AuthoringDrawer` opens for create (via `KindPicker` -> chosen kind) and
 * edit (row-inspector "Edit" action). Both get SHACL fields + relationship
 * entity-pickers from the drawer. */
export default function InstancesPage() {
  const browser = useInstanceBrowser();
  const [selectedIri, setSelectedIri] = useState<string | null>(null);
  const { resource, loading: inspectorLoading } = useInspector(selectedIri);
  const [drawerShape, setDrawerShape] = useState<KindEntry | null>(null);
  const [addingKind, setAddingKind] = useState(false);

  const selectedRow = browser.rows.find((row) => row.iri === selectedIri);
  const selectedKind = browser.kinds.find((kind) => kind.iri === selectedRow?.kindIri) ?? null;

  const openEdit = () => {
    if (selectedKind) setDrawerShape(selectedKind);
  };

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
    <div className="grid grid-cols-[1fr_320px] gap-[var(--space-4)] p-[var(--space-4)]">
      <InstanceBrowserPage
        kinds={buildKindOptions(browser.kinds)}
        activeKindFilter={browser.activeKindFilter}
        onToggleKind={browser.toggleKindFilter}
        searchTerm={browser.searchTerm}
        onSearchChange={browser.setSearchTerm}
        columns={COLUMNS}
        rows={buildRows(browser.rows)}
        loading={browser.loading}
        errorMessage={browser.errorMessage}
        selectedRowId={selectedIri ?? undefined}
        onSelectRow={setSelectedIri}
        addAction={
          <Button type="button" onClick={() => setAddingKind(true)}>
            Add entity
          </Button>
        }
        inspector={buildInspectorProps(resource, inspectorLoading, openEdit)}
      />
      <ChatAside />
    </div>
  );
}
