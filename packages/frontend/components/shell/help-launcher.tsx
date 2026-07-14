"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { t } from "@/lib/onboarding/i18n";

const LINK_CLASS = "text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline";

/** ONB-V1-TASK-002 AC-002-01: help-launcher entry into the completeness-map
 * tour, offered only while on an Explorer route -- the same deep-link the
 * ExplorerTour component autostarts on (`?tour=completeness-map`). */
function CompletenessTourEntry() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/explorer")) return null;
  return (
    <a href="/explorer?tour=completeness-map" className={LINK_CLASS}>
      Take the completeness-map tour
    </a>
  );
}

/** IA §6 help content — thin M1 links; per-area contextual help and guided
 * tours land with the v1.0 docs surface. */
function HelpTopics() {
  return (
    <nav aria-label="Help topics" className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
      <p className="text-[length:var(--text-label)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Get started
      </p>
      <a href="/role-home" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
        What can Weave do for you? — your role-tailored capabilities and next step
      </a>
      <a href="/ce" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
        Model your company — add Processes, Actors, Goals in the Constitution
      </a>
      <a href="/ce/query" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
        Ask questions in plain language — Query the graph
      </a>
      <a href="/explorer" className={LINK_CLASS}>
        See the whole company — Graph Explorer
      </a>
      <CompletenessTourEntry />
      <a href="/build" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
        Request an application generated from your model — Build
      </a>
      <a href="/audit" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
        Every change, hash-chained — Audit trail
      </a>
      <p className="mt-[var(--space-2)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        Docs, keyboard shortcuts, and per-area guides arrive with the v1.0 help centre.
      </p>
    </nav>
  );
}

/** AC-7: "?" icon in the nav opens a contextual help panel in place --
 * a Radix Dialog (focus-trap, Escape-to-close, restore-focus) rather than
 * a navigation to a /help route.
 */
export function HelpLauncher() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Help"
          className="rounded-[var(--radius-full)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          ?
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content
          aria-label="Help"
          className="fixed right-0 top-0 h-full w-full max-w-[360px] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]"
        >
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Help
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Press Cmd+K (or Ctrl+K) to search. This panel is contextual to the area you&apos;re
            viewing.
          </Dialog.Description>
          <HelpTopics />
          {/* TASK-010 AC-010-05: restore a dismissed dashboard checklist. */}
          <button
            type="button"
            onClick={() => void fetch("/api/onboarding/checklist/restore", { method: "POST" })}
            className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
          >
            {t("onboarding.checklist.restore")}
          </button>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close help"
              className="mt-[var(--space-4)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
