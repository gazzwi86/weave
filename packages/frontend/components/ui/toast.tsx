import type { ReactNode } from "react";

import { Button } from "./button";

export interface ToastProps {
  message: ReactNode;
  onDismiss: () => void;
}

/**
 * Non-blocking, transient notification -- distinct from
 * components/shell/notification-center.tsx's persistent Radix Dialog panel.
 * Every colour/spacing/radius/shadow/motion value is a design token (Law 20);
 * `motion-reduce:` disables the fade for reduced-motion users.
 */
export function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-[var(--space-4)] left-1/2 z-[var(--z-toast)] flex -translate-x-1/2 items-center gap-[var(--space-3)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-raised)] px-[var(--space-4)] py-[var(--space-3)] shadow-[var(--shadow-overlay)] transition-opacity duration-[var(--duration-base)] ease-[var(--ease-standard)] motion-reduce:transition-none"
    >
      <span className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">{message}</span>
      <Button variant="secondary" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
