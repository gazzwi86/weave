import { ceEditingSurface } from "@/lib/explorer/ce-editing-surface";
import { toBpmoKind, toEdgeRows } from "@/lib/explorer/inspector-view";
import { ErrorCard } from "@/components/ui/error-card";
import { KindChip } from "@/components/molecules/KindChip";

import { CommentsPanel } from "./comments-panel";
import { ConflictNotice, DeleteConfirmDialog, DeleteFailedToast, EditDeleteButtons, PanelEditDrawer } from "./side-panel-edit";
import type { UsePanelEditResult } from "./use-panel-edit";
import type { SidePanelState } from "./use-node-spotlight";

export interface SidePanelProps {
  state: SidePanelState;
  onClose: () => void;
  onRetry: () => void;
  /** TASK-027 AC-5: soft dependency on TASK-023/024's edge-draw controller
   * -- feature-detected. undefined (the M1 default, since those tasks are
   * absent) falls back to a CE-surface link instead. */
  onEditGap?: (nodeId: string, predicateIri: string) => void;
  /** TASK-024 AC-1..AC-8: property edit + delete -- feature-detected same
   * as onEditGap. undefined hides all edit/delete affordances (read-only
   * panel). */
  panelEdit?: UsePanelEditResult;
  /** AC-8: UX-only gate -- hides Edit/Delete buttons for viewers and while
   * pinned to a read-only version. CE-WRITE-1 rejects server-side anyway. */
  canEdit?: boolean;
  /** refit: clicking an Edges row re-runs the spotlight on the target node
   * -- reuses useNodeSpotlight's own openNode, never a second fetch path. */
  onOpenNode?: (nodeId: string) => void;
}

// refit: glass-panel treatment (GlassPanel.tsx's own utility classes,
// inlined since that component doesn't accept a positioning className) --
// canvas-overlay is one of the surfaces design.md reserves glass for.
const PANEL_CLASSES =
  "absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)] w-80 max-w-[calc(100%-var(--space-8))] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-[var(--space-5)] shadow-[var(--shadow-overlay)] backdrop-blur-md";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
    >
      Close
    </button>
  );
}

interface HeadingProps {
  label: string;
  typeLabel: string;
  bpmoKind: ReturnType<typeof toBpmoKind>;
  onClose: () => void;
}

// refit: kind-coloured swatch (mock's `.canvas-inspector` header) when the
// node's bpmo_kind resolves to a known BPMO kind -- KindChip always pairs
// colour with a glyph (WCAG 1.4.1), never colour alone. Unrecognised/absent
// falls back to the original plain-text type label.
function Heading({ label, typeLabel, bpmoKind, onClose }: HeadingProps) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-2)]">
      <div>
        <p className="break-words text-[length:var(--text-h4)] text-[var(--color-text-default)]">{label}</p>
        {bpmoKind ? <KindChip kind={bpmoKind} label={typeLabel} /> : <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{typeLabel}</p>}
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

// AC-2: the raw IRI is only ever rendered inside this disclosure, and only
// when the proxy route decided to send one (rawIri !== null -> ontologist).
function AdvancedDisclosure({ rawIri }: { rawIri: string | null }) {
  if (rawIri === null) return null;
  return (
    <details className="mt-[var(--space-3)]">
      <summary className="cursor-pointer text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Advanced / technical details
      </summary>
      <p className="mt-[var(--space-1)] break-all font-[var(--font-mono)] text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)]">
        {rawIri}
      </p>
    </details>
  );
}

interface MissingLinksProps {
  nodeId: string;
  gaps: NonNullable<Extract<SidePanelState, { status: "loaded" }>["gaps"]>;
  onEditGap?: (nodeId: string, predicateIri: string) => void;
}

// TASK-027 AC-4/AC-5: the accessible surface for a gap-flagged node's
// missing links -- humanised labels only (never a raw predicate IRI), each
// with an inline edge-draw shortcut when TASK-023/024's edit controller is
// available, else a link into the existing CE editing surface.
function MissingLinks({ nodeId, gaps, onEditGap }: MissingLinksProps) {
  if (gaps.length === 0) return null;
  return (
    <div className="mt-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-2)]">
      <h2 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Missing links</h2>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {gaps.map((gap) =>
          onEditGap ? (
            <li key={gap.missingLink}>
              <button
                type="button"
                onClick={() => onEditGap(nodeId, gap.missingLink)}
                className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:text-[var(--color-accent-primary)]"
              >
                Add {gap.label}…
              </button>
            </li>
          ) : (
            <li key={gap.missingLink}>
              <a
                href={ceEditingSurface(nodeId)}
                className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:text-[var(--color-accent-primary)]"
              >
                {gap.label}
              </a>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

interface EdgesSectionProps {
  neighbours: Extract<SidePanelState, { status: "loaded" }>["neighbours"];
  onOpenNode?: (nodeId: string) => void;
}

// refit: clickable relationship rows (mock's `.canvas-inspector` edges
// list) -- reuses toEdgeRows' humanised predicate labels, never a raw IRI.
function EdgesSection({ neighbours, onOpenNode }: EdgesSectionProps) {
  const edges = toEdgeRows(neighbours);
  if (edges.length === 0) return null;
  return (
    <div className="mt-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-2)]">
      <h2 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Edges</h2>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {edges.map((edge) => (
          <li key={edge.id}>
            <button
              type="button"
              onClick={() => onOpenNode?.(edge.targetIri)}
              className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:text-[var(--color-accent-primary)]"
            >
              {edge.predicateLabel} → {edge.targetLabel}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// refit: mock's "Instances" button -- links into the existing CE instances
// list rather than duplicating it inside the panel.
function InstancesLink() {
  return (
    <a
      href="/ce/instances"
      className="mt-[var(--space-3)] inline-block text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
    >
      View all instances
    </a>
  );
}

interface LoadedPanelBodyProps {
  state: Extract<SidePanelState, { status: "loaded" }>;
  onEditGap?: (nodeId: string, predicateIri: string) => void;
  panelEdit?: UsePanelEditResult;
  canEdit: boolean;
  onOpenNode?: (nodeId: string) => void;
}

/** The `status === "loaded"` branch's body -- split out of `SidePanel` to
 * keep it under Law E's complexity + line budgets. */
function LoadedPanelBody({ state, onEditGap, panelEdit, canEdit, onOpenNode }: LoadedPanelBodyProps) {
  const showViewContent = !panelEdit || panelEdit.edit.mode === "view";
  return (
    <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
      {showViewContent &&
        state.keyProperties.map((property) => (
          <div key={property.path}>
            <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{property.label}</p>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{property.value}</p>
          </div>
        ))}
      {panelEdit && panelEdit.edit.mode === "view" && <EditDeleteButtons panelEdit={panelEdit} canEdit={canEdit} />}
      {panelEdit && <PanelEditDrawer state={state} panelEdit={panelEdit} />}
      {panelEdit && <ConflictNotice panelEdit={panelEdit} />}
      <AdvancedDisclosure rawIri={state.rawIri} />
      <CommentsPanel targetKind="node" targetRef={state.nodeId} />
      <MissingLinks nodeId={state.nodeId} gaps={state.gaps ?? []} onEditGap={onEditGap} />
      {showViewContent && <EdgesSection neighbours={state.neighbours} onOpenNode={onOpenNode} />}
      {showViewContent && <InstancesLink />}
    </div>
  );
}

export function SidePanel({ state, onClose, onRetry, onEditGap, panelEdit, canEdit = false, onOpenNode }: SidePanelProps) {
  if (state.status === "closed") return null;

  if (state.status === "not-found") {
    return (
      <div className={PANEL_CLASSES} data-testid="explorer-side-panel">
        <div className="flex items-center justify-between">
          <p className="text-[length:var(--text-body)] text-[var(--color-text-default)]">Not found</p>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    );
  }

  const bpmoKind = state.status === "loaded" ? toBpmoKind(state.bpmoKind) : null;

  return (
    <div className={PANEL_CLASSES} data-testid="explorer-side-panel">
      <Heading label={state.label} typeLabel={state.typeLabel} bpmoKind={bpmoKind} onClose={onClose} />

      {state.status === "loading" && (
        <p className="mt-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">Loading…</p>
      )}

      {/* refit: the CE node-details 503 (unmerged PR #132's proxy issue)
          surfaces here exactly like any other detail-fetch failure -- this
          IS the correct rendering, not a bug to route around. */}
      {state.status === "error" && (
        <ErrorCard title="Details unavailable" body="Something went wrong loading this node." onRetry={onRetry} />
      )}

      {state.status === "loaded" && (
        <LoadedPanelBody state={state} onEditGap={onEditGap} panelEdit={panelEdit} canEdit={canEdit} onOpenNode={onOpenNode} />
      )}
      {panelEdit && <DeleteConfirmDialog panelEdit={panelEdit} />}
      {panelEdit && <DeleteFailedToast panelEdit={panelEdit} />}
    </div>
  );
}
