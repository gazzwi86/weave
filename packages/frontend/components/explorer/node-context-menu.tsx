"use client";

export interface NodeContextMenuProps {
  position: { x: number; y: number } | null;
  canFocusDomain: boolean;
  isExpanded: boolean;
  onFocusDomain: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
}

const MENU_ITEM_CLASSES =
  "block w-full rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]";

function MenuItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onSelect} className={MENU_ITEM_CLASSES}>
      {label}
    </button>
  );
}

/**
 * TASK-005 AC-3/AC-5: right-click context menu for a node -- "Focus domain"
 * (domain-kind nodes only) and exactly one of "Expand neighbours" /
 * "Collapse neighbours" depending on the node's current expansion state
 * (see renderer-adapter.ts's hasExpandedNeighbours).
 */
export function NodeContextMenu({
  position,
  canFocusDomain,
  isExpanded,
  onFocusDomain,
  onExpand,
  onCollapse,
  onClose,
}: NodeContextMenuProps) {
  if (!position) return null;

  const runAndClose = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div
      role="menu"
      aria-label="Node actions"
      style={{ position: "fixed", left: position.x, top: position.y }}
      className="z-[var(--z-panel)] min-w-[160px] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-1)] shadow-[var(--shadow-panel)]"
    >
      {canFocusDomain && <MenuItem label="Focus domain" onSelect={runAndClose(onFocusDomain)} />}
      {isExpanded ? (
        <MenuItem label="Collapse neighbours" onSelect={runAndClose(onCollapse)} />
      ) : (
        <MenuItem label="Expand neighbours" onSelect={runAndClose(onExpand)} />
      )}
    </div>
  );
}
