"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PUBLIC_PATHS } from "@/lib/public-paths";

import { CommandPalette } from "./command-palette";
import { HelpLauncher } from "./help-launcher";
import { Nav } from "./nav";
import { NotificationCenter } from "./notification-center";

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
        <div className="flex items-center gap-[var(--space-2)]">
          <NotificationCenter />
          <HelpLauncher />
        </div>
      </header>
      <CommandPalette />
      <div className="flex-1">{children}</div>
    </div>
  );
}
