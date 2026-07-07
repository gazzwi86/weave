import type { DomainFocusState } from "./use-domain-focus";

export interface DomainFocusNoticeProps {
  state: DomainFocusState;
  onRetry: () => void;
  onDismiss: () => void;
}

const NOTICE_CLASSES =
  "absolute bottom-[var(--space-4)] left-1/2 z-[var(--z-panel)] w-full max-w-sm -translate-x-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-panel)]";

const ACTION_BUTTON_CLASSES =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]";

/** TASK-005 AC-2/AC-9: domain-focus empty-state message and dismissable
 * CE-READ-1 error notice with retry -- both surfaced from useDomainFocus's
 * state machine, never a new fetch path of their own. */
export function DomainFocusNotice({ state, onRetry, onDismiss }: DomainFocusNoticeProps) {
  if (state.status === "empty") {
    return (
      <div className={NOTICE_CLASSES} data-testid="domain-focus-notice">
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">This domain has no members</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={NOTICE_CLASSES} data-testid="domain-focus-notice">
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">{state.message}</p>
        <div className="mt-[var(--space-2)] flex justify-end gap-[var(--space-2)]">
          <button type="button" onClick={onDismiss} className={ACTION_BUTTON_CLASSES}>
            Dismiss
          </button>
          <button type="button" onClick={onRetry} className={ACTION_BUTTON_CLASSES}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return null;
}
