"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PUBLIC_PATHS } from "@/lib/public-paths";

import { AvatarMenu } from "./avatar-menu";
import { CommandPalette } from "./command-palette";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";
import { findSection } from "./nav-items";
import { NotificationCenter } from "./notification-center";
import { SectionRail } from "./section-rail";
import { useSidebarCollapsed } from "./use-sidebar-collapsed";
import { OnboardingHintsHost } from "../onboarding/onboarding-hints-host";
import { PracticeModeBanner } from "../onboarding/practice-mode-banner";

export interface AppShellProps {
  children: ReactNode;
  /** Display-only workspace role from the session (lib/auth/session-claims). */
  role?: string | null;
  /** Tenant chip in the top bar (IA §3 workspace switcher slot). */
  tenantId?: string | null;
  /** Display name from the OIDC profile (session.user.name), AC-7. */
  userName?: string | null;
}

/** Breadcrumb text: the active section, then the current page's label
 * resolved from that section's secondary nav (nav-items.ts) -- no separate
 * per-route title table to drift out of sync. */
function Breadcrumb({ pathname }: { pathname: string }) {
  const section = findSection(pathname);
  if (!section) return null;
  const page = section.groups
    .flatMap((group) => group.items)
    .find((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)));
  return (
    <span className="truncate text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
      <b className="font-[var(--font-weight-medium)] text-[var(--color-text-default)]">{section.label}</b>
      {page ? (
        <>
          <span className="mx-[var(--space-1)] text-[var(--color-text-subtle)]">/</span>
          {page.label}
        </>
      ) : null}
    </span>
  );
}

/** Expand affordance for a collapsed sidebar -- shown only on routes that
 * own a secondary rail (matches the mock's breadcrumb-zone `»`). */
function SidebarExpandButton({ pathname }: { pathname: string }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  const section = findSection(pathname);
  if (!collapsed || !section || section.groups.length === 0) return null;
  return (
    <button
      type="button"
      aria-label="Expand sidebar"
      onClick={toggle}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[length:var(--text-label)] text-[var(--color-text-subtle)] hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      »
    </button>
  );
}

/** The slim command bar (44px top bar centre) -- a button styled like the
 * ⌘K palette input; clicking dispatches the same open event the palette
 * listens for, so it opens from anywhere regardless of the ⌘K route guard. */
function CommandBarTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("weave:open-command-palette"))}
      aria-label="Search, ask, or jump to"
      className="flex h-[30px] w-[420px] max-w-full items-center gap-[var(--space-2)] rounded-[var(--radius-full)] border border-transparent bg-[var(--color-raised)] px-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)] [background-image:linear-gradient(var(--color-raised),var(--color-raised)),var(--gradient-accent)] [background-origin:border-box] [background-clip:padding-box,border-box] hover:shadow-[0_0_0_2px_var(--color-accent-primary)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <span className="flex-1 text-left">Search, ask, or jump to…</span>
      <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] px-[var(--space-1)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        ⌘K
      </kbd>
    </button>
  );
}

export function AppShell({ children, role = null, tenantId = null, userName = null }: AppShellProps) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Nav userName={userName} />
      <SectionRail role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-[var(--space-4)] border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-4)]">
          <div className="flex w-[340px] shrink-0 items-center gap-[var(--space-2)]">
            <SidebarExpandButton pathname={pathname} />
            {tenantId ? (
              <span className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
                {tenantId}
              </span>
            ) : null}
            <Breadcrumb pathname={pathname} />
          </div>
          <div className="flex flex-1 justify-center">
            <CommandBarTrigger />
          </div>
          <div className="flex w-[200px] shrink-0 items-center justify-end gap-[var(--space-3)]">
            <NotificationCenter role={role} />
            <HelpLauncher />
            <AvatarMenu userName={userName ?? "Signed in"} role={role} />
          </div>
        </header>
        <PracticeModeBanner />
        <CommandPalette />
        <OnboardingHintsHost />
        {/* Content wrapper is a plain div, not <main>: every page renders its
            own <main> landmark, so a <main> here would duplicate it (axe
            landmark-no-duplicate-main). The flex/overflow scroll chain is
            tag-agnostic. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
