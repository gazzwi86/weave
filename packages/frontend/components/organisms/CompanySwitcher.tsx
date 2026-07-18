import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface CompanySwitcherCompany {
  id: string;
  name: string;
}

export interface CompanySwitcherProps {
  companies: CompanySwitcherCompany[];
  activeId: string | null;
  /** True while the list/active fetch is in flight. */
  loading?: boolean;
  /** True when the list/active fetch failed -- distinct from an empty list. */
  error?: boolean;
  onSelect: (id: string) => void;
  className?: string;
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function CompanyRow({
  company,
  active,
  onSelect,
}: {
  company: CompanySwitcherCompany;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      disabled={active}
      onClick={() => onSelect(company.id)}
      className={cn(
        "flex w-full items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left",
        "text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] transition-colors",
        "hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] disabled:cursor-default"
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-[var(--space-5)] w-[var(--space-5)] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[image:var(--gradient-accent)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] text-[var(--color-bg)]"
      >
        {initial(company.name)}
      </span>
      <span className="flex-1 truncate text-[var(--color-text-default)]">{company.name}</span>
      {active ? <Icon name="check" size={14} className="text-[var(--color-accent-primary)]" /> : null}
    </button>
  );
}

/** refit-mock.html's `#user-backdrop` "company switcher -- SUPER ADMIN ONLY"
 * section: super-admins operate across companies (workspace == company),
 * so this lists them with a check mark on the active one. Purely
 * presentational -- `components/shell/avatar-menu.tsx` owns the data fetch
 * and the real switch call. */
function statusMessage(loading: boolean, error: boolean): string | null {
  if (loading) return "Loading companies…";
  if (error) return "Couldn't load companies.";
  return null;
}

export function CompanySwitcher({ companies, activeId, loading = false, error = false, onSelect, className }: CompanySwitcherProps) {
  const status = statusMessage(loading, error);
  return (
    <div className={cn("flex flex-col border-b border-[var(--color-border)] pb-[var(--space-2)]", className)}>
      <p className="px-[var(--space-3)] pb-[var(--space-1)] pt-[var(--space-2)] text-[length:var(--text-overline)] uppercase text-[var(--color-text-subtle)]">
        Company
      </p>
      {status ? (
        <p className="px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{status}</p>
      ) : (
        companies.map((company) => (
          <CompanyRow key={company.id} company={company} active={company.id === activeId} onSelect={onSelect} />
        ))
      )}
    </div>
  );
}
