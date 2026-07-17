"use client";

import type { ReactNode } from "react";

import { Drawer } from "./Drawer";

export interface DocDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Dot-separated meta strip, e.g. ["Updated 2026-07-17", "v3", "Approved"]. */
  meta: string[];
  children: ReactNode;
}

function DocMeta({ meta }: { meta: string[] }) {
  if (meta.length === 0) return null;
  return (
    <div className="flex gap-[var(--space-4)] border-b border-[var(--color-border)] pb-[var(--space-3)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
      {meta.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

/** refit-mock.html `.drawer.doc`/`.doc-meta`/`.doc-body` -- the wide (`doc`
 * size) read-only document panel (Brief/PRD/Epics). Drawer for the chrome, a
 * `.doc-meta`-equivalent strip, then rich caller-supplied body content
 * styled per `.doc-body h5/p/li`. */
export function DocDrawer({ open, onClose, title, meta, children }: DocDrawerProps) {
  return (
    <Drawer open={open} onClose={onClose} icon="book" tone="var(--color-accent-primary)" title={title} size="doc">
      <DocMeta meta={meta} />
      <div
        className={[
          "flex flex-col gap-[var(--space-2)]",
          "[&_h3]:mt-[var(--space-5)] [&_h3]:mb-[var(--space-2)] [&_h3]:text-[length:var(--text-label)]",
          "[&_h3]:font-[var(--font-weight-semibold)] [&_h3]:text-[var(--color-text-default)]",
          "[&_p]:text-[length:var(--text-body-sm)] [&_p]:leading-relaxed [&_p]:text-[var(--color-text-muted)]",
          "[&_li]:text-[length:var(--text-body-sm)] [&_li]:leading-relaxed [&_li]:text-[var(--color-text-muted)]",
        ].join(" ")}
      >
        {children}
      </div>
    </Drawer>
  );
}
