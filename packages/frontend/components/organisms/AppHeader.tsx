import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
  /** Section + page label (shell resolves this from the active route). */
  breadcrumb: ReactNode;
  /** Tenant/workspace chip, left of the breadcrumb. */
  tenantChip?: ReactNode;
  /** Shows the panel-open expand affordance only while the sidebar is collapsed. */
  sidebarCollapsed?: boolean;
  onExpandSidebar?: () => void;
  /** Opens the command palette; the trigger renders only when wired. */
  onOpenCommandBar?: () => void;
  /** Smart Dialog-trigger components (NotificationCenter/HelpLauncher/UserMenu) --
   * AppHeader only arranges them, it never owns their open state. */
  notifications?: ReactNode;
  help?: ReactNode;
  account?: ReactNode;
  /** Split "New" button -- omitted entirely when no action is wired, so it
   * never renders as a dead CTA. */
  onNewAction?: () => void;
  onNewMore?: () => void;
  newLabel?: string;
  className?: string;
}

function SidebarExpandButton({ onExpandSidebar }: { onExpandSidebar: () => void }) {
  return (
    <button
      type="button"
      aria-label="Expand sidebar"
      title="Show sidebar"
      onClick={onExpandSidebar}
      className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      <Icon name="panel-open" size={17} />
    </button>
  );
}

/** The command bar trigger: a button styled like the ⌘K palette input, using
 * the full brand-spectrum gradient border (refit-mock.html's `.cmdbar`) --
 * never `--gradient-accent`, that gradient is reserved for the avatar. */
function CommandBarTrigger({ onOpenCommandBar }: { onOpenCommandBar: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenCommandBar}
      aria-label="Search entities"
      className={cn(
        "flex h-[var(--space-6)] w-[var(--size-cmdbar)] max-w-full items-center gap-[var(--space-2)] rounded-[var(--radius-full)]",
        "border border-transparent bg-[var(--color-raised)] px-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]",
        "[background-image:linear-gradient(var(--color-raised),var(--color-raised)),var(--gradient-brand)] [background-origin:border-box] [background-clip:padding-box,border-box]",
        "transition-shadow duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:shadow-[0_0_18px_rgba(34,211,238,0.18)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
      )}
    >
      <Icon name="search" size={14} />
      <span className="flex-1 truncate text-left">Search entities…</span>
      <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] px-[var(--space-1)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        ⌘K
      </kbd>
    </button>
  );
}

function NewSplitButton({
  onNewAction,
  onNewMore,
  newLabel = "New",
}: {
  onNewAction: () => void;
  onNewMore?: () => void;
  newLabel?: string;
}) {
  return (
    <div
      title="New model entity"
      className="mx-[var(--space-2)] flex h-[var(--space-6)] overflow-hidden rounded-[var(--radius-base)] border border-[var(--color-border-strong)]"
    >
      <button
        type="button"
        onClick={onNewAction}
        className="flex items-center gap-[var(--space-1)] border-r border-black/25 bg-[var(--color-accent-primary)] px-[var(--space-3)] text-[length:var(--text-label)] font-[var(--font-weight-semibold)] text-[var(--color-bg)] transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        <Icon name="plus" size={14} />
        {newLabel}
      </button>
      {onNewMore ? (
        <button
          type="button"
          onClick={onNewMore}
          aria-label={`${newLabel} — more options`}
          className="flex items-center bg-[var(--color-accent-primary)] px-[var(--space-1)] text-[var(--color-bg)] transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <Icon name="chev-d" size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** Topbar (refit-mock.html's `.topbar`, `--size-topbar` tall): breadcrumb +
 * optional sidebar-expand slot on the left, a centred `--size-cmdbar`-wide
 * gradient command bar, and a right-hand action cluster. Notifications/Help/
 * Account stay smart (Dialog-owning) components passed in as slots -- see
 * `components/shell/`. */
export function AppHeader({
  breadcrumb,
  tenantChip,
  sidebarCollapsed = false,
  onExpandSidebar,
  onOpenCommandBar,
  notifications,
  help,
  account,
  onNewAction,
  onNewMore,
  newLabel,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-[var(--size-topbar)] shrink-0 items-center gap-[var(--space-4)]",
        "border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-4)]",
        className
      )}
    >
      <div className="flex w-[var(--size-topbar-zone)] shrink-0 items-center gap-[var(--space-2)]">
        {sidebarCollapsed && onExpandSidebar ? <SidebarExpandButton onExpandSidebar={onExpandSidebar} /> : null}
        {tenantChip}
        {breadcrumb}
      </div>
      <div className="flex min-w-0 flex-1 justify-center">
        {onOpenCommandBar ? <CommandBarTrigger onOpenCommandBar={onOpenCommandBar} /> : null}
      </div>
      <div className="flex w-[var(--size-topbar-zone)] shrink-0 items-center justify-end gap-[var(--space-2)]">
        {notifications}
        {help}
        {onNewAction ? <NewSplitButton onNewAction={onNewAction} onNewMore={onNewMore} newLabel={newLabel} /> : null}
        {account}
      </div>
    </header>
  );
}
