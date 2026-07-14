"use client";

import { useState } from "react";

import { GuidedForm } from "../chat/guided-form";
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
 * `AuthoringDrawer` opens for create (kind picker via `GuidedForm`'s
 * existing kind select) and edit (row-inspector "Edit" action).
 */
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

  if (drawerShape && selectedRow) {
    return (
      <AuthoringDrawer
        shape={drawerShape}
        mode="edit"
        targetIri={selectedRow.iri}
        initialValues={{ label: selectedRow.label }}
        onClose={() => setDrawerShape(null)}
      />
    );
  }

  if (addingKind) {
    return <GuidedForm kindIri={browser.kinds[0]?.iri ?? ""} onClose={() => setAddingKind(false)} />;
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
