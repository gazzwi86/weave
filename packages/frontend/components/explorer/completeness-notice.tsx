const NOTICE_CLASSES =
  "absolute bottom-[var(--space-4)] left-1/2 z-[var(--z-panel)] w-full max-w-sm -translate-x-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-panel)]";

const ACTION_BUTTON_CLASSES =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]";

export interface CompletenessNoticeProps {
  /** AC-2: "No coverage gaps found" -- overlay still activated. */
  notice: string | null;
  /** AC-3: fetch failed -- overlay never activated, canvas untouched. */
  error: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/** TASK-027 AC-2/AC-3: completeness-overlay empty-state message and
 * dismissable error notice with retry -- both surfaced from
 * useCompletenessOverlay's state, never a new fetch path of their own. */
export function CompletenessNotice({ notice, error, onRetry, onDismiss }: CompletenessNoticeProps) {
  if (error) {
    return (
      <div className={NOTICE_CLASSES} data-testid="completeness-notice">
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          Couldn&apos;t check coverage gaps — retry
        </p>
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

  if (notice) {
    return (
      <div className={NOTICE_CLASSES} data-testid="completeness-notice">
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{notice}</p>
      </div>
    );
  }

  return null;
}
