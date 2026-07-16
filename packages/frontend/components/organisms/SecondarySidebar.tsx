import { cn } from "@/lib/utils";

export interface SecondarySidebarItem {
  label: string;
  href?: string;
  /** Roadmap pill text (e.g. "M2", "post-v1") -- absent for shipped items. */
  tag?: string;
}

/** ONB-V1-TASK-003: the sidebar row whose `href` matches this literal gets
 * `data-tour-id="plat.role-home.nav-entry"`. Kept as a static string
 * (never `item.tourId`-style interpolation) because `audit-anchors.ts`'s
 * scanner is a literal-attribute regex, not a JSX evaluator -- a dynamic
 * prop would be invisible to it (ADR-005 two-way audit). */
const ROLE_HOME_NAV_ENTRY_HREF = "/role-home";

export interface SecondarySidebarGroup {
  heading: string;
  items: SecondarySidebarItem[];
}

export interface SecondarySidebarProps {
  groups: SecondarySidebarGroup[];
  activeHref?: string;
  /** Section name shown in the sidebar head (v5 shell). Omit for no head. */
  title?: string;
  /** Collapse control in the head; the button is omitted when absent. */
  onCollapse?: () => void;
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

  const linkClassName = cn(
    rowClass,
    "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]",
    isActive && "bg-[var(--color-raised)] text-[var(--color-text-default)]"
  );

  // ADR-008: only the role-home entry plants an anchor -- a literal branch
  // (see ROLE_HOME_NAV_ENTRY_HREF) rather than an interpolated attribute.
  if (item.href === ROLE_HOME_NAV_ENTRY_HREF) {
    return (
      <li>
        <a href={item.href} aria-current={isActive ? "page" : undefined} data-tour-id="plat.role-home.nav-entry" className={linkClassName}>
          <span>{item.label}</span>
          {item.tag ? <span className="text-[length:var(--text-caption)]">{item.tag}</span> : null}
        </a>
      </li>
    );
  }

  return (
    <li>
      <a href={item.href} aria-current={isActive ? "page" : undefined} className={linkClassName}>
        <span>{item.label}</span>
        {item.tag ? <span className="text-[length:var(--text-caption)]">{item.tag}</span> : null}
      </a>
    </li>
  );
}

/** Section-scoped left rail (extracted from the stateful
 * `components/shell/section-rail.tsx`, which owns `usePathname` + RBAC filtering). */
export function SecondarySidebar({ groups, activeHref, title, onCollapse, className }: SecondarySidebarProps) {
  return (
    <nav
      aria-label="Secondary"
      className={cn(
        "w-[var(--size-sidebar)] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-4)]",
        className
      )}
    >
      {title || onCollapse ? (
        <div className="mb-[var(--space-3)] flex items-center justify-between px-[var(--space-2)]">
          {title ? (
            <span className="text-[length:var(--text-label)] font-[var(--font-weight-semibold)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
              {title}
            </span>
          ) : null}
          {onCollapse ? (
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={onCollapse}
              className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[length:var(--text-label)] text-[var(--color-text-subtle)] hover:border-[var(--color-accent-primary)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
            >
              «
            </button>
          ) : null}
        </div>
      ) : null}
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
