"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon, type IconName } from "../ui/icon";

export type DrawerSize = "default" | "lg" | "xl" | "doc";

const WIDTH_CLASS: Record<DrawerSize, string> = {
  default: "w-[var(--size-drawer)]",
  lg: "w-[var(--size-drawer-lg)]",
  xl: "w-[var(--size-drawer-xl)]",
  doc: "w-[var(--size-drawer-doc)]",
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  icon: IconName;
  /** CSS colour value (e.g. `var(--color-accent-primary)`) for the header
   * icon chip -- tint is derived via `color-mix`, never a hardcoded hex. */
  tone: string;
  title: ReactNode;
  /** Optional status pill/badge rendered after the title. */
  pill?: ReactNode;
  /** 440 default / 480 lg / 520 xl / 640 doc, per refit-mock.html `.drawer`. */
  size?: DrawerSize;
  children: ReactNode;
  /** Right-aligned footer actions. */
  footer?: ReactNode;
  /** Left-aligned footer slot (e.g. a Delete button) -- styling is the
   * caller's choice, Drawer only positions it. */
  dangerSlot?: ReactNode;
}

type DrawerHeadProps = Pick<DrawerProps, "icon" | "tone" | "title" | "pill" | "onClose">;

function DrawerHead({ icon, tone, title, pill, onClose }: DrawerHeadProps) {
  return (
    <div className="flex items-center gap-[var(--space-3)] border-b border-[var(--color-border)] px-[var(--space-5)] py-[var(--space-4)]">
      <span
        className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)]"
        style={{ background: `color-mix(in srgb, ${tone} 18%, transparent)`, color: tone }}
      >
        <Icon name={icon} size={14} />
      </span>
      <Dialog.Title className="flex-1 truncate text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {title}
      </Dialog.Title>
      {pill}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

type DrawerFootProps = Pick<DrawerProps, "footer" | "dangerSlot">;

function DrawerFoot({ footer, dangerSlot }: DrawerFootProps) {
  if (!footer && !dangerSlot) return null;
  return (
    <div className="flex items-center gap-[var(--space-2)] border-t border-[var(--color-border)] px-[var(--space-5)] py-[var(--space-4)]">
      {dangerSlot ? <div className="mr-auto flex items-center gap-[var(--space-2)]">{dangerSlot}</div> : null}
      <div className="ml-auto flex items-center gap-[var(--space-2)]">{footer}</div>
    </div>
  );
}

/** refit-mock.html `.drawer`/`.drawer-backdrop` -- the shared right-fixed
 * panel organism (EntityEditDrawer, DocDrawer compose this). Radix Dialog
 * gives backdrop-click + Escape close, the focus trap, and `aria-modal` for
 * free -- same primitive as ConfirmDialog. */
export function Drawer({
  open,
  onClose,
  icon,
  tone,
  title,
  pill,
  size = "default",
  children,
  footer,
  dangerSlot,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[var(--z-panel)] bg-[var(--color-overlay)] opacity-80",
            "animate-[fadeIn_var(--duration-slow)_var(--ease-out)]"
          )}
        />
        <Dialog.Content
          aria-modal="true"
          className={cn(
            "fixed top-0 right-0 bottom-0 z-[var(--z-panel)] flex flex-col",
            "border-l border-[var(--color-border-strong)] bg-[var(--color-overlay)] shadow-[var(--shadow-panel)]",
            "animate-[drawerIn_var(--duration-slow)_var(--ease-out)]",
            WIDTH_CLASS[size]
          )}
        >
          <DrawerHead icon={icon} tone={tone} title={title} pill={pill} onClose={onClose} />
          {/* tabIndex makes the scroll region itself keyboard-reachable
              (arrow/Page-Down scroll) when its content has no focusable
              children of its own -- axe `scrollable-region-focusable`. */}
          <div
            tabIndex={0}
            className="flex-1 overflow-y-auto px-[var(--space-5)] py-[var(--space-4)]"
          >
            {children}
          </div>
          <DrawerFoot footer={footer} dangerSlot={dangerSlot} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
