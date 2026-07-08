"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PUBLIC_PATHS } from "@/lib/public-paths";

import { CommandPalette } from "./command-palette";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";
import { NotificationCenter } from "./notification-center";
import { SectionRail } from "./section-rail";
import { WorkspaceSwitcher } from "./workspace-switcher";

export interface AppShellProps {
  children: ReactNode;
  /** Display-only workspace role from the session (lib/auth/session-claims). */
  role?: string | null;
  /** Tenant chip next to the brand (IA §3 workspace switcher slot). */
  tenantId?: string | null;
}

export function AppShell({ children, role = null, tenantId = null }: AppShellProps) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)] sticky top-0 z-[var(--z-sticky)] bg-[var(--color-bg)]">
        <div className="flex items-center">
          <Link
            href="/dashboard"
            prefetch={false}
            className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand mark */}
            <img src="/logo.png" alt="" className="mr-[var(--space-2)] inline h-[22px] w-auto align-middle" />
            weave
          </Link>
          {tenantId ? <WorkspaceSwitcher tenantId={tenantId} /> : null}
          <Nav />
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <NotificationCenter />
          <HelpLauncher />
          {/* next-auth's built-in signout confirmation page — zero custom code. */}
          <Link
            href="/api/auth/signout"
            prefetch={false}
            className="text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
          >
            Sign out
          </Link>
        </div>
      </header>
      <CommandPalette />
      <div className="flex flex-1">
        <SectionRail role={role} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
