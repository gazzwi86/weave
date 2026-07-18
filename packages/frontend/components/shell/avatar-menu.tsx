"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { UserMenu, type UserMenuItem } from "@/components/organisms/UserMenu";
import { isPlatformOperator } from "@/lib/auth/session-claims";

export interface AvatarMenuProps {
  /** Display name from the session (`session.user.name`); "Signed in" is
   * the fallback when the OIDC profile carries none. */
  userName: string;
  /** Canonical role resolved via `PLAT-IDENTITY-1` (session-claims). */
  role: string | null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "")).toUpperCase();
}

/** AC-7: profile name, canonical role, help link, and "Sign out" all live
 * inside one avatar menu -- "Sign out" never renders as a bare header link
 * outside it. Radix Dialog for the same focus-trap/Escape/restore-focus
 * behaviour already used by `HelpLauncher`/`NotificationCenter`. Presentation
 * lives in the `UserMenu` organism (refit-mock.html's `#user-backdrop`);
 * this wrapper owns the Dialog and the real hrefs.
 *
 * "Profile & preferences" and "Switch workspace" are the mock's items, added
 * alongside (not instead of) the existing Help/Sign out links -- dropping
 * Help would regress AC-7. "Theme" has no theme-switch feature yet (dark is
 * the only shipped theme, design.md), so it renders as a static "Dark" pill
 * rather than an interactive control that would do nothing.
 *
 * "Operator console" (refit-mock.html's `#user-backdrop`, "Operator console
 * — provision companies") is gated by `isPlatformOperator` -- the same
 * predicate the `/operator` route itself checks -- so this entry point and
 * that route's gate can't drift apart. */
export function AvatarMenu({ userName, role }: AvatarMenuProps) {
  const operatorItems: UserMenuItem[] = isPlatformOperator(role)
    ? [{ icon: "shield", label: "Operator console — provision companies", href: "/operator" }]
    : [];

  const items: UserMenuItem[] = [
    ...operatorItems,
    { icon: "user", label: "Profile & preferences", href: "/settings", separatorBefore: operatorItems.length > 0 },
    { icon: "swap", label: "Switch workspace", href: "/settings/workspaces" },
    { icon: "moon", label: "Theme", trailing: <span>Dark</span> },
    { icon: "help", label: "Help", href: "/help" },
    { icon: "logout", label: "Sign out", href: "/api/auth/signout", separatorBefore: true },
  ];

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Account menu"
        className="flex h-[var(--space-6)] w-[var(--space-6)] items-center justify-center rounded-[var(--radius-full)] bg-[image:var(--gradient-accent)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] text-[var(--color-bg)] transition-shadow hover:shadow-[0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-accent-primary)] data-[state=open]:shadow-[0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-accent-primary)]"
      >
        {initials(userName)}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content
          aria-label="Account menu"
          className="fixed right-[var(--space-4)] top-[var(--space-10)] w-full max-w-[280px] rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)]/80 p-[var(--space-3)] shadow-[var(--shadow-overlay)] backdrop-blur-md"
        >
          <Dialog.Title className="sr-only">Account menu</Dialog.Title>
          <UserMenu name={userName} role={role} items={items} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
