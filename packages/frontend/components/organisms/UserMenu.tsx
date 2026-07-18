import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface UserMenuItem {
  icon: IconName;
  label: string;
  href?: string;
  onClick?: () => void;
  /** e.g. a "Dark" theme pill, right-aligned. */
  trailing?: ReactNode;
  /** Renders a divider above this item (mock's `.menu-sep`, e.g. before Sign out). */
  separatorBefore?: boolean;
}

export interface UserMenuProps {
  name: string;
  email?: string;
  role?: string | null;
  items: UserMenuItem[];
  /** Renders between the identity row and the item list (mock's super-admin
   * company switcher section) -- absent for every role that doesn't get one. */
  beforeItems?: ReactNode;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

function MenuRow({ item }: { item: UserMenuItem }) {
  const rowClass = cn(
    "flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)]",
    "text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)]"
  );
  const content = (
    <>
      <Icon name={item.icon} size={15} />
      <span className="flex-1">{item.label}</span>
      {item.trailing}
    </>
  );

  return (
    <>
      {item.separatorBefore ? <div data-menu-separator className="my-[var(--space-1)] h-px bg-[var(--color-border)]" /> : null}
      {item.href ? (
        <a href={item.href} className={rowClass}>
          {content}
        </a>
      ) : (
        <button type="button" onClick={item.onClick} className={cn(rowClass, "w-full text-left")}>
          {content}
        </button>
      )}
    </>
  );
}

/** Account flyout (refit-mock.html's `#user-backdrop`): gradient two-letter
 * avatar + name/role, then icon menu rows -- extracted from
 * `components/shell/avatar-menu.tsx`, which owns the Radix Dialog and the
 * real hrefs/handlers. */
export function UserMenu({ name, email, role, items, beforeItems, className }: UserMenuProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-2)] pb-[var(--space-2)]">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[image:var(--gradient-accent)] text-[length:var(--text-label)] font-[var(--font-weight-bold)] text-[var(--color-bg)]"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {name}
          </p>
          {email ? (
            <p className="truncate text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{email}</p>
          ) : null}
          {role ? (
            <p className="truncate text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{role}</p>
          ) : null}
        </div>
      </div>
      {beforeItems}
      <div className="flex flex-col">
        {items.map((item) => (
          <MenuRow key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}
