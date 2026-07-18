import { useState } from "react";

import { lastIriSegment } from "@/lib/explorer/map-rows-to-elements";
import type { FilterOp, FilterState, GovernedLayer, PropertyFilter } from "@/lib/explorer/filter-state";

import type { LayerStatus } from "./use-filter-panel";

export interface FilterPanelProps {
  entityTypes: string[];
  relTypes: string[];
  filterState: FilterState;
  onToggleEntityType: (kindIri: string) => void;
  onToggleRelType: (predicateIri: string) => void;
  onSetPropertyFilters: (filters: PropertyFilter[]) => void;
}

export interface LayerPanelProps {
  layerStatus: Record<GovernedLayer, LayerStatus>;
  onToggleLayer: (layer: GovernedLayer) => void;
}

const FILTER_OPS: FilterOp[] = ["eq", "neq", "contains", "gt", "lt"];
const GOVERNED_LAYERS: GovernedLayer[] = ["glossary", "brand", "governance"];
const LAYER_LABEL: Record<GovernedLayer, string> = { glossary: "Glossary", brand: "Brand", governance: "Governance" };

const LABEL_CLASS = "text-[length:var(--text-body-sm)] text-[var(--color-text-default)]";
const SECTION_CLASS = "space-y-[var(--space-2)]";
const HEADING_CLASS = "text-[length:var(--text-caption)] text-[var(--color-text-subtle)]";

// AC-1/AC-3: one checkbox per kind/predicate present on canvas -- checked
// means "visible" (i.e. NOT in the off list), matching the toggle's own
// off-list semantics so a fresh canvas load starts everything checked.
function TypeToggleList({
  items,
  offList,
  onToggle,
  displayLabel,
}: {
  items: string[];
  offList: string[];
  onToggle: (value: string) => void;
  displayLabel: (value: string) => string;
}) {
  return (
    <ul className={SECTION_CLASS}>
      {items.map((item) => (
        <li key={item}>
          <label className="flex items-center gap-[var(--space-2)]">
            <input type="checkbox" checked={!offList.includes(item)} onChange={() => onToggle(item)} />
            <span className={LABEL_CLASS}>{displayLabel(item)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function FilterChip({ filter, onRemove }: { filter: PropertyFilter; onRemove: () => void }) {
  const text = `${filter.path} ${filter.op} ${filter.value}`;
  return (
    <li className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)]">
      <span className={LABEL_CLASS}>{text}</span>
      <button type="button" aria-label={`Remove filter: ${text}`} onClick={onRemove} className="text-[var(--color-text-muted)]">
        ×
      </button>
    </li>
  );
}

function FilterChipsList({ filters, onRemoveAt }: { filters: PropertyFilter[]; onRemoveAt: (index: number) => void }) {
  if (filters.length === 0) return null;
  return (
    <ul className="space-y-[var(--space-1)]">
      {filters.map((filter, index) => (
        <FilterChip key={`${filter.path}-${filter.op}-${filter.value}-${index}`} filter={filter} onRemove={() => onRemoveAt(index)} />
      ))}
    </ul>
  );
}

function PropertyFilterForm({ onAdd }: { onAdd: (filter: PropertyFilter) => void }) {
  const [path, setPath] = useState("");
  const [op, setOp] = useState<FilterOp>("eq");
  const [value, setValue] = useState("");

  function addFilter() {
    if (!path || !value) return;
    onAdd({ path, op, value });
    setPath("");
    setValue("");
  }

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label className={LABEL_CLASS}>
        Property path
        <input type="text" value={path} onChange={(event) => setPath(event.target.value)} className="block w-full" />
      </label>
      <label className={LABEL_CLASS}>
        Comparison
        <select value={op} onChange={(event) => setOp(event.target.value as FilterOp)} className="block w-full">
          {FILTER_OPS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL_CLASS}>
        Value
        <input type="text" value={value} onChange={(event) => setValue(event.target.value)} className="block w-full" />
      </label>
      <button
        type="button"
        onClick={addFilter}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]"
      >
        Add filter
      </button>
    </div>
  );
}

// AC-4/AC-5: builds one PropertyFilter from three keyboard-operable fields;
// evalFilter (filter-state.ts) does the AND-combine + missing-path matching,
// this form only ever appends to the array -- no CE query issued.
function PropertyFilterBuilder({
  filters,
  onSetPropertyFilters,
}: {
  filters: PropertyFilter[];
  onSetPropertyFilters: (filters: PropertyFilter[]) => void;
}) {
  return (
    <div className={SECTION_CLASS}>
      <h2 className={HEADING_CLASS}>Property filters</h2>
      <FilterChipsList filters={filters} onRemoveAt={(index) => onSetPropertyFilters(filters.filter((_, i) => i !== index))} />
      <PropertyFilterForm onAdd={(filter) => onSetPropertyFilters([...filters, filter])} />
    </div>
  );
}

// AC-6: a layer stays enabled ("off"/"on") unless the last fetch came back
// empty -- an empty toggle is disabled with a tooltip rather than hidden,
// so re-toggling never silently no-ops.
function LayerToggleList({
  layerStatus,
  onToggleLayer,
}: {
  layerStatus: Record<GovernedLayer, LayerStatus>;
  onToggleLayer: (layer: GovernedLayer) => void;
}) {
  return (
    <ul className={SECTION_CLASS} data-tour-id="ge.filters.governed-content">
      {GOVERNED_LAYERS.map((layer) => {
        const status = layerStatus[layer];
        const label = LAYER_LABEL[layer];
        return (
          <li key={layer}>
            <button
              type="button"
              role="switch"
              aria-checked={status === "on"}
              aria-label={`Toggle ${label} layer`}
              disabled={status === "empty"}
              title={status === "empty" ? `No ${label} content` : undefined}
              onClick={() => onToggleLayer(layer)}
              className="flex w-full items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] disabled:pointer-events-none disabled:opacity-50"
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** TASK-020, refit into ControlDock's "Filters" tab panel: entity/rel-type
 * toggles + the property-filter builder -- every field reads from
 * useFilterPanel's return value and every action calls straight back into
 * it (this component owns no filter state itself). Governed layers moved
 * to their own `LayerPanel` ("Layers" tab, mock's separate `panel-layers`). */
export function FilterPanel({
  entityTypes,
  relTypes,
  filterState,
  onToggleEntityType,
  onToggleRelType,
  onSetPropertyFilters,
}: FilterPanelProps) {
  return (
    <div data-testid="explorer-filter-panel" className="space-y-[var(--space-4)]">
      <div className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Entity types</h2>
        <TypeToggleList
          items={entityTypes}
          offList={filterState.entityTypesOff}
          onToggle={onToggleEntityType}
          displayLabel={(kind) => kind}
        />
      </div>
      <div className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>Relationship types</h2>
        <TypeToggleList
          items={relTypes}
          offList={filterState.relTypesOff}
          onToggle={onToggleRelType}
          displayLabel={lastIriSegment}
        />
      </div>
      <PropertyFilterBuilder filters={filterState.propertyFilters} onSetPropertyFilters={onSetPropertyFilters} />
    </div>
  );
}

/** ControlDock's "Layers" tab panel (mock's `panel-layers`) -- governed-layer
 * toggles, split out of `FilterPanel` (TASK-020's original bundle). */
export function LayerPanel({ layerStatus, onToggleLayer }: LayerPanelProps) {
  return (
    <div data-testid="explorer-layer-panel">
      <LayerToggleList layerStatus={layerStatus} onToggleLayer={onToggleLayer} />
    </div>
  );
}
