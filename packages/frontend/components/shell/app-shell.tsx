"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/organisms/AppHeader";
import { ToastProvider } from "@/components/ui/toast/toast-provider";
import { PUBLIC_PATHS } from "@/lib/public-paths";

import { AvatarMenu } from "./avatar-menu";
import { CommandPalette } from "./command-palette";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";
import { findSection } from "./nav-items";
import { NotificationCenter } from "./notification-center";
import { SectionRail } from "./section-rail";
import { useSidebarCollapseHotkey, useSidebarCollapsed } from "./use-sidebar-collapsed";
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
  // Longest-match, not first-match: /ce/types and /ce (both prefix matches)
  // both qualify, and the section's items aren't ordered by specificity, so
  // taking array order silently picked /ce ("Overview") for every subpage.
  const page = section.groups
    .flatMap((group) => group.items)
    .filter((item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return (
    <span
      data-testid="breadcrumb"
      className="truncate text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]"
    >
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

/** Dispatches the same open event the command palette listens for, so it
 * opens from anywhere regardless of the ⌘K route guard. */
function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("weave:open-command-palette"));
}

function TenantChip({ tenantId }: { tenantId: string | null }) {
  if (!tenantId) return null;
  return (
    <span className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
      {tenantId}
    </span>
  );
}

export function AppShell({ children, role = null, tenantId = null, userName = null }: AppShellProps) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);
  const [collapsed, expand] = useSidebarCollapsed();
  const section = findSection(pathname);
  const canExpand = Boolean(section && section.groups.length > 0);
  useSidebarCollapseHotkey(expand);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden">
        <Nav userName={userName} />
        <SectionRail role={role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            tenantChip={<TenantChip tenantId={tenantId} />}
            breadcrumb={<Breadcrumb pathname={pathname} />}
            sidebarCollapsed={collapsed && canExpand}
            onExpandSidebar={expand}
            onOpenCommandBar={openCommandPalette}
            notifications={<NotificationCenter role={role} />}
            help={<HelpLauncher />}
            account={<AvatarMenu userName={userName ?? "Signed in"} role={role} />}
          />
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
    </ToastProvider>
  );
}
