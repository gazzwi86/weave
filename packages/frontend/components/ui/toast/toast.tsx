import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Icon, type IconName } from "../icon";

export type ToastVariant = "success" | "error" | "info";

export interface ToastProps {
  message: ReactNode;
  onDismiss: () => void;
  /** TASK-023 AC-5: an optional retry action, distinct from dismissing. */
  action?: { label: string; onClick: () => void };
  variant?: ToastVariant;
  /** ToastProvider-only: true while the exit transition plays, before this
   * entry is actually removed from the stack. Direct callers (TASK-023's
   * original usage -- they unmount the instant `onDismiss` fires, so there's
   * no window for a closing frame to render) never need to pass this. */
  closing?: boolean;
}

const VARIANT_ICON: Record<ToastVariant, IconName> = { success: "check", error: "x", info: "sparkles" };
const VARIANT_CHIP_STYLE: Record<ToastVariant, string> = {
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  error: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  info: "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]",
};
const VARIANT_ROLE: Record<ToastVariant, "alert" | "status"> = { success: "status", error: "alert", info: "status" };

/**
 * Non-blocking, transient notification -- distinct from
 * components/shell/notification-center.tsx's persistent Radix Dialog panel.
 * Every colour/spacing/radius/shadow/motion value is a design token (Law 20);
 * `motion-reduce:` disables the fly-in/out animation for reduced-motion
 * users. Purely presentational -- lifetime (auto-dismiss timing, the exit
 * transition's `closing` window) is owned by ToastProvider, not this atom.
 */
export function Toast({ message, onDismiss, action, variant = "error", closing = false }: ToastProps) {
  return (
    <div
      role={VARIANT_ROLE[variant]}
      className={cn(
        "flex w-full max-w-[var(--size-flyout)] items-center gap-[var(--space-3)] rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)]/[.72] px-[var(--space-4)] py-[var(--space-3)] shadow-[var(--shadow-overlay)] backdrop-blur-md",
        "animate-[flyUpIn_var(--duration-slow)_var(--ease-standard)]",
        "transition-[opacity,transform] duration-[var(--duration-slow)] ease-[var(--ease-standard)] motion-reduce:animate-none motion-reduce:transition-none",
        closing ? "translate-y-[var(--space-1)] opacity-0" : "translate-y-0 opacity-100"
      )}
    >
      <span
        className={cn(
          "flex h-[var(--space-5)] w-[var(--space-5)] shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
          VARIANT_CHIP_STYLE[variant]
        )}
      >
        <Icon name={VARIANT_ICON[variant]} size={13} />
      </span>
      <span className="flex-1 text-[length:var(--text-body-sm)] leading-snug text-[var(--color-text-default)]">
        {message}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="flex h-[var(--space-5)] w-[var(--space-5)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]"
      >
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
