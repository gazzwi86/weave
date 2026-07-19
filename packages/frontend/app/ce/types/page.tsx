"use client";

import { useState } from "react";

import type { DataTableRow } from "@/components/templates/FilterableTablePage";
import { DataTableNameCell, FilterableTablePage } from "@/components/templates/FilterableTablePage";
import { Button } from "@/components/ui/button";
import type { FilterChip } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { InfoTip } from "@/components/ui/info-tip";
import { useToast } from "@/components/ui/toast";

import type { KindEntry, PropertyShape } from "../chat/types";
import { buildTypeRows, type TypesCategory } from "./types-rows";
import type { TypeDrawerState } from "./use-type-drawer";
import { useTypeDrawer } from "./use-type-drawer";
import { useTypes } from "./use-types";

const PAGE_SIZE = 8;

const CATEGORY_CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "framework", label: "Framework" },
  { id: "extensions", label: "Extensions" },
  { id: "relationships", label: "Relationships" },
];

const TYPE_COLUMNS = [
  { key: "kind", label: "Kind" },
  { key: "description", label: "Description" },
  { key: "instances", label: "Instances" },
  { key: "origin", label: "Origin" },
];

const KIND_FIELDS_GAP_TOAST = "Kind editing isn't available yet.";
const VIEW_ON_CANVAS_GAP_TOAST = "Explore-canvas linking isn't available yet.";

function TypesHeader({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Types
      </h1>
      <InfoTip
        title="Kinds — the model's grammar"
        body="A kind is a category of business thing: Process, Actor, System, Policy… Weave ships the framework kinds as a grammar; you add extension kinds for your own domain language."
        how="Every kind carries a validation rule-set, so its instances always stay well-formed."
      />
      <Button className="ml-auto" onClick={onNew}>
        <Icon name="plus" size={13} />
        New extension kind
      </Button>
    </div>
  );
}

/** Builds the hover-reveal edit/view-on-canvas actions for a row, given the
 * catalogue lists needed to resolve a row id back to its kind or
 * relationship (kept out of the page body for the Law E line budget). */
function makeRowActions(
  kinds: KindEntry[],
  relationships: PropertyShape[],
  drawer: TypeDrawerState,
  onViewOnCanvas: () => void
) {
  function renderRowActions(row: DataTableRow) {
    const kind = kinds.find((entry) => entry.iri === row.id);
    const rel = relationships.find((entry) => entry.path === row.id);
    const label = kind?.label ?? rel?.name ?? row.id;
    return (
      <>
        <Button variant="ghost" aria-label={`Edit ${label}`} onClick={() => kind && drawer.openEdit(kind)}>
          <Icon name="pencil" size={13} />
        </Button>
        <Button variant="ghost" aria-label={`View ${label} on canvas`} onClick={onViewOnCanvas}>
          <Icon name="graph" size={13} />
        </Button>
      </>
    );
  }
  return renderRowActions;
}

interface TypesTableArgs {
  category: TypesCategory;
  search: string;
  onCategory: (id: string) => void;
  onSearch: (value: string) => void;
  pageRows: DataTableRow[];
  loading: boolean;
  rowActions: ReturnType<typeof makeRowActions>;
  pageInfo: { page: number; pageCount: number; rangeStart: number; rangeEnd: number; total: number; onPageChange: (page: number) => void };
  loadErrorInfo?: { onRetry: () => void };
  drawerProps: ReturnType<typeof buildDrawerProps>;
}

/** Assembles the full `FilterableTablePage` prop set (kept out of the page
 * body for the Law E line budget -- see `types-rows.ts`/`use-type-drawer.ts`
 * for why the underlying data shaping lives in separate files too). */
function buildTypesTableProps(args: TypesTableArgs) {
  const { category, search, onCategory, onSearch, pageRows, loading, rowActions, pageInfo, loadErrorInfo, drawerProps } = args;
  return {
    filterBar: {
      chips: CATEGORY_CHIPS,
      activeIds: [category],
      onToggle: onCategory,
      search: { value: search, onChange: onSearch, label: "Search kinds" },
    },
    columns: TYPE_COLUMNS,
    rows: pageRows,
    loading,
    renderRowActions: rowActions,
    pagination: {
      page: pageInfo.page,
      pageCount: pageInfo.pageCount,
      rangeLabel: `Showing ${pageInfo.rangeStart}–${pageInfo.rangeEnd} of ${pageInfo.total}`,
      onPageChange: pageInfo.onPageChange,
    },
    error: loadErrorInfo
      ? { title: "Couldn't load the kind catalogue", body: "The types endpoint didn't respond.", onRetry: loadErrorInfo.onRetry }
      : undefined,
    drawer: drawerProps,
  };
}

/** Slices `rows` to one page and derives the footer's range label bounds
 * (kept out of the page body for the Law E line budget). */
function paginate(rows: DataTableRow[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = rows.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, rows.length);
  return { pageRows, pageCount, rangeStart, rangeEnd };
}

/** Maps drawer draft state onto `EntityEditDrawer` props (kept out of the
 * page body for the Law E line budget). */
function buildDrawerProps(drawer: TypeDrawerState, onSave: () => void) {
  return {
    open: drawer.open,
    onClose: drawer.close,
    onSave,
    icon: "tag" as const,
    tone: "var(--color-accent-primary)",
    title: drawer.kind ? `Edit ${drawer.kind.label}` : "New extension kind",
    label: drawer.label,
    onLabelChange: drawer.setLabel,
    description: drawer.description,
    onDescriptionChange: drawer.setDescription,
    kindFields: drawer.kind ? <DataTableNameCell label={drawer.kind.label} id={drawer.kind.iri} /> : undefined,
  };
}

/** Ontology / Types (IA §2.1): the BPMO kind catalogue served by the
 * authoritative CE-READ-1 `GET /api/ontology/types` -- never a hand-copied
 * list. View-only browse in M1 (see `types-rows.ts` for why Instances/
 * Origin are honest placeholders, not fabricated values). Page stays
 * data-binding only: filtering/row-shaping lives in `types-rows.ts`, drawer
 * draft state in `use-type-drawer.ts`, per the dumb/smart component split.
 */
export default function CeTypesPage() {
  const { kinds, relationships, loading, loadError, reload } = useTypes();
  const drawer = useTypeDrawer();
  const { toast } = useToast();
  const [category, setCategory] = useState<TypesCategory>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const rows = buildTypeRows(kinds, relationships, category, search);
  const { pageRows, pageCount, rangeStart, rangeEnd } = paginate(rows, page, PAGE_SIZE);

  const handleCategory = (id: string) => {
    setCategory(id as TypesCategory);
    setPage(1);
  };
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };
  const handleSave = () => {
    toast({ message: KIND_FIELDS_GAP_TOAST, variant: "info" });
    drawer.close();
  };
  const onViewOnCanvas = () => toast({ message: VIEW_ON_CANVAS_GAP_TOAST, variant: "info" });
  const tableProps = buildTypesTableProps({
    category,
    search,
    onCategory: handleCategory,
    onSearch: handleSearch,
    pageRows,
    loading,
    rowActions: makeRowActions(kinds, relationships, drawer, onViewOnCanvas),
    pageInfo: { page, pageCount, rangeStart, rangeEnd, total: rows.length, onPageChange: setPage },
    loadErrorInfo: loadError ? { onRetry: reload } : undefined,
    drawerProps: buildDrawerProps(drawer, handleSave),
  });

  return (
    <main data-tour-id="ce.types" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <TypesHeader onNew={drawer.openNew} />
      <FilterableTablePage {...tableProps} />
    </main>
  );
}
