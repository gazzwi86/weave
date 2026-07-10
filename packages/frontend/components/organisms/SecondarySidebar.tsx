import { cn } from "@/lib/utils";

export interface SecondarySidebarItem {
  label: string;
  href?: string;
  /** Roadmap pill text (e.g. "M2", "post-v1") -- absent for shipped items. */
  tag?: string;
}

export interface SecondarySidebarGroup {
  heading: string;
  items: SecondarySidebarItem[];
}

export interface SecondarySidebarProps {
  groups: SecondarySidebarGroup[];
  activeHref?: string;
  className?: string;
}

function SidebarRow({ item, isActive }: { item: SecondarySidebarItem; isActive: boolean }) {
  const rowClass =
    "flex items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]";

  if (!item.href) {
    return (
      <li className={cn(rowClass, "text-[var(--color-text-muted)]")}>
        <span>{item.label}</span>
        {item.tag ? <span className="text-[length:var(--text-caption)]">{item.tag}</span> : null}
      </li>
    );
  }

  return (
    <li>
      <a
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          rowClass,
          "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
          isActive && "bg-[var(--color-raised)] text-[var(--color-text-default)]"
        )}
      >
        <span>{item.label}</span>
        {item.tag ? <span className="text-[length:var(--text-caption)]">{item.tag}</span> : null}
      </a>
    </li>
  );
}

/** Section-scoped left rail (extracted from the stateful
 * `components/shell/section-rail.tsx`, which owns `usePathname` + RBAC filtering). */
export function SecondarySidebar({ groups, activeHref, className }: SecondarySidebarProps) {
  return (
    <nav
      aria-label="Secondary"
      className={cn(
        "w-52 shrink-0 border-r border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-4)]",
        className
      )}
    >
      {groups.map((group) => (
        <div key={group.heading} className="mb-[var(--space-4)]">
          <p className="px-[var(--space-2)] pb-[var(--space-1)] text-[length:var(--text-overline)] tracking-[var(--text-overline-tracking)] uppercase text-[var(--color-text-muted)]">
            {group.heading}
          </p>
          <ul className="flex flex-col gap-[var(--space-1)]">
            {group.items.map((item) => (
              <SidebarRow key={item.label} item={item} isActive={item.href === activeHref} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
