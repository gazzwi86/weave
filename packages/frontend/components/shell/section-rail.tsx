"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  findSection,
  TAG_LABEL,
  type SecondaryNavItem,
  type SurfaceTag,
} from "./nav-items";

/** Status pill on every rail item (IA rule: every surface carries a tag). */
function TagPill({ tag }: { tag: SurfaceTag }) {
  // Always the neutral variant: the tinted success/info badges fall below
  // 4.5:1 at --text-caption size over the rail's raised/hover backgrounds
  // (axe color-contrast, light theme). Meaning rides on the label text
  // anyway (WCAG 1.4.1).
  return <Badge>{TAG_LABEL[tag]}</Badge>;
}

function RailItem({ item, pathname, role }: {
  item: SecondaryNavItem;
  pathname: string;
  role: string | null;
}) {
  if (item.adminOnly && role !== "admin") return null;

  const rowClass =
    "flex items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]";

  if (!item.href) {
    // Phase placeholder: dimmed, not a link ("Delivered in phase X" lives on
    // the pill; there is deliberately no dead route behind it).
    return (
      <li className={cn(rowClass, "text-[var(--color-text-muted)]")}>
        <span>{item.label}</span>
        <TagPill tag={item.tag} />
      </li>
    );
  }

  const isActive = pathname === item.href;
  return (
    <li>
      <Link
        href={item.href}
        prefetch={false}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          rowClass,
          "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
          isActive && "bg-[var(--color-raised)] text-[var(--color-text-default)]"
        )}
      >
        <span>{item.label}</span>
        {/* A shipped surface needs no roadmap pill -- the pills exist to
            flag what is NOT built yet (placeholders and phase tags). */}
        {item.tag !== "built" && <TagPill tag={item.tag} />}
      </Link>
    </li>
  );
}

/** Section-scoped left rail (IA §3): grouped secondary nav for the section
 * owning the current pathname; nothing for rail-less sections (Home). */
export function SectionRail({ role }: { role: string | null }) {
  const pathname = usePathname();
  const section = findSection(pathname);

  if (!section || section.groups.length === 0) return null;

  return (
    <nav
      aria-label="Secondary"
      className="w-52 shrink-0 border-r border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-4)]"
    >
      {section.groups.map((group) => (
        <div key={group.heading} className="mb-[var(--space-4)]">
          <p className="px-[var(--space-2)] pb-[var(--space-1)] text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] uppercase text-[var(--color-text-muted)]">
            {group.heading}
          </p>
          <ul className="flex flex-col gap-[var(--space-1)]">
            {group.items.map((item) => (
              <RailItem key={item.label} item={item} pathname={pathname} role={role} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
