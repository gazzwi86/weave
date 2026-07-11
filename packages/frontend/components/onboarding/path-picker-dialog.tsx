"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";

// ponytail: @weave/shared isn't wired as a frontend workspace dependency
// anywhere in this codebase yet (no tsconfig path, no package.json dep) --
// duplicating this 4-entry label map locally is smaller than adding that
// wiring for one table. Mirrors packages/shared/onboarding/role-paths.ts;
// wire the real import if/when the frontend starts consuming @weave/shared.
export type RolePath = "business" | "technical" | "compliance" | "admin";
const ROLE_PATHS: readonly RolePath[] = ["business", "technical", "compliance", "admin"];
const ROLE_PATH_LABELS: Record<RolePath, string> = {
  business: "Business",
  technical: "Technical",
  compliance: "Compliance",
  admin: "Admin",
};

export interface PathPickerDialogProps {
  open: boolean;
  current: RolePath;
  onChoose: (path: RolePath) => void;
  onCancel: () => void;
}

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

/** ONB-TASK-006 AC-006-02/04: picks/changes the onboarding path. AC-006-02's
 * auto-prompt-on-multi-role never triggers in M1 (deferred -- no multi-role
 * source exists yet); this dialog is reused as-is for "change my onboarding
 * path" (AC-006-04).
 */
export function PathPickerDialog({ open, current, onChoose, onCancel }: PathPickerDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label="Choose onboarding path" className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Choose your onboarding path
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            You can change this at any time from Settings.
          </Dialog.Description>
          <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
            {ROLE_PATHS.map((path) => (
              <Button
                key={path}
                type="button"
                variant={path === current ? "primary" : "secondary"}
                onClick={() => onChoose(path)}
              >
                {ROLE_PATH_LABELS[path]}
              </Button>
            ))}
          </div>
          <div className="mt-[var(--space-4)] flex justify-end">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
