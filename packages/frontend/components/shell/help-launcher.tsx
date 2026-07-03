"use client";

import * as Dialog from "@radix-ui/react-dialog";

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
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)]" />
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
