"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CommandPalette } from "./command-palette";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";

// Matches middleware.ts's PUBLIC_PATHS -- the anonymous landing and login
// screens have no signed-in tenant, so there's nothing for the nav/search
// palette to scope to.
const PUBLIC_PATHS = new Set(["/", "/auth/login"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)] sticky top-0 z-[var(--z-sticky)] bg-[var(--color-bg)]">
        <Nav />
        <HelpLauncher />
      </header>
      <CommandPalette />
      <div className="flex-1">{children}</div>
    </div>
  );
}
