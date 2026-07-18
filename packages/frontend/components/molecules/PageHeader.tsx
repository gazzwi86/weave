import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Absent for the current page's own crumb -- rendered as plain text, not a link. */
  href?: string;
}

export interface PageHeaderProps {
  /** Uppercase page kicker above the title (e.g. "Home"), accent-toned. */
  eyebrow?: string;
  title: string;
  /** Inline node rendered inside the `<h1>` right after the title text --
   * the operator/CE screens hang an `InfoTip` "?" here (refit-mock.html
   * `data-qt` on the heading itself). */
  titleTrailing?: ReactNode;
  subtitle?: string;
  /** IA wireframe trail (e.g. "Workspace / Constitution / Instances", F-D06) -- omitted entirely
   * when absent, never an empty nav landmark. */
  breadcrumb?: BreadcrumbItem[];
  /** Right-aligned action slot (buttons), rendered as-is -- no business logic. */
  actions?: ReactNode;
  className?: string;
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-[var(--space-1)] flex items-center gap-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
    >
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-[var(--space-2)]">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <a href={item.href} className="hover:text-[var(--color-text-default)]">
              {item.label}
            </a>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Page-level heading. `--text-h1` is the only token the title slot may
 * resolve to (F-D07: built app was rendering titles too small and too
 * light instead).
 */
export function PageHeader({
  eyebrow,
  title,
  titleTrailing,
  subtitle,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-[var(--space-4)]", className)}>
      <div>
        {breadcrumb && breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
        {eyebrow ? <Eyebrow tone="accent">{eyebrow}</Eyebrow> : null}
        <h1 className="text-[length:var(--text-h1)] font-[var(--font-weight-bold)] text-[var(--color-text-default)]">
          {title}
          {titleTrailing}
        </h1>
        {subtitle ? (
          <p className="mt-[var(--space-1)] text-[length:var(--text-body)] text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-[var(--space-2)]">{actions}</div> : null}
    </header>
  );
}
