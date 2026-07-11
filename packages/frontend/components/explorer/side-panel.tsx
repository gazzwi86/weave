import { CommentsPanel } from "./comments-panel";
import type { SidePanelState } from "./use-node-spotlight";

export interface SidePanelProps {
  state: SidePanelState;
  onClose: () => void;
  onRetry: () => void;
}

const PANEL_CLASSES =
  "absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)] w-80 max-w-[calc(100%-var(--space-8))] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-panel)]";

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

function Heading({ label, typeLabel, onClose }: { label: string; typeLabel: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-2)]">
      <div>
        <p className="text-[length:var(--text-h4)] text-[var(--color-text-default)]">{label}</p>
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{typeLabel}</p>
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

export function SidePanel({ state, onClose, onRetry }: SidePanelProps) {
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

  return (
    <div className={PANEL_CLASSES} data-testid="explorer-side-panel">
      <Heading label={state.label} typeLabel={state.typeLabel} onClose={onClose} />

      {state.status === "loading" && (
        <p className="mt-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">Loading…</p>
      )}

      {state.status === "error" && (
        <div className="mt-[var(--space-3)]">
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">Details unavailable — retry</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "loaded" && (
        <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
          {state.keyProperties.map((property) => (
            <div key={property.path}>
              <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{property.label}</p>
              <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{property.value}</p>
            </div>
          ))}
          <AdvancedDisclosure rawIri={state.rawIri} />
          <CommentsPanel targetKind="node" targetRef={state.nodeId} />
        </div>
      )}
    </div>
  );
}
