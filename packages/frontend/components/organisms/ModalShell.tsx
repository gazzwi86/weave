"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { GlassPanel } from "./GlassPanel";

export type ModalShellSize = "sm" | "md" | "lg";

const WIDTH_CLASS: Record<ModalShellSize, string> = {
  sm: "max-w-[var(--size-modal)]",
  md: "max-w-[var(--size-modal-md)]",
  lg: "max-w-[var(--size-modal-lg)]",
};

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** 420 sm (default) / 440 md / 460 lg, per refit-mock.html `.modal`. */
  size?: ModalShellSize;
  children: ReactNode;
  className?: string;
}

/** refit-mock.html `.modal-wrap`/`.modal` -- the shared centred glass modal
 * base. ConfirmDialog composes this instead of hand-rolling its own
 * Dialog.Overlay/Dialog.Content + surface classes; EntityPickerModal does
 * too. Surface styling (radius/border/bg/shadow/blur) is GlassPanel's --
 * ModalShell only owns positioning + open/close/size. */
export function ModalShell({ open, onClose, size = "sm", children, className }: ModalShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)] opacity-80",
            "animate-[fadeIn_var(--duration-slow)_var(--ease-out)]"
          )}
        />
        <Dialog.Content
          aria-modal="true"
          className={cn(
            "fixed top-1/2 left-1/2 z-[var(--z-modal)] w-full -translate-x-1/2 -translate-y-1/2",
            "animate-[popIn_var(--duration-slow)_var(--ease-out)]",
            WIDTH_CLASS[size]
          )}
        >
          <GlassPanel className={className}>{children}</GlassPanel>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
