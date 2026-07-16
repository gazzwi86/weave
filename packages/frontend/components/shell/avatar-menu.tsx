"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";

export interface AvatarMenuProps {
  /** Display name from the session (`session.user.name`); "Signed in" is
   * the fallback when the OIDC profile carries none. */
  userName: string;
  /** Canonical role resolved via `PLAT-IDENTITY-1` (session-claims). */
  role: string | null;
}

/** AC-7: profile name, canonical role, help link, and "Sign out" all live
 * inside one avatar menu -- "Sign out" never renders as a bare header link
 * outside it. Radix Dialog for the same focus-trap/Escape/restore-focus
 * behaviour already used by `HelpLauncher`/`NotificationCenter`. */
export function AvatarMenu({ userName, role }: AvatarMenuProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Account menu"
        className="flex h-[var(--space-6)] w-[var(--space-6)] items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-surface)] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
      >
        {userName.charAt(0).toUpperCase()}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content
          aria-label="Account menu"
          className="fixed right-[var(--space-4)] top-[var(--space-10)] w-full max-w-[240px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)]/80 p-[var(--space-3)] shadow-[var(--shadow-overlay)] backdrop-blur-md"
        >
          <Dialog.Title className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {userName}
          </Dialog.Title>
          {role ? (
            <p className="mt-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
              {role}
            </p>
          ) : null}
          <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] border-t border-[var(--color-border)] pt-[var(--space-2)]">
            <Link
              href="/help"
              prefetch={false}
              className="text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
            >
              Help
            </Link>
            {/* next-auth's built-in signout confirmation page — zero custom code. */}
            <Link
              href="/api/auth/signout"
              prefetch={false}
              className="text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
            >
              Sign out
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
