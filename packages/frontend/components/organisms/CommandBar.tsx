import { cn } from "@/lib/utils";

export interface CommandBarResult {
  id: string;
  label: string;
}

export interface CommandBarProps {
  query: string;
  results: CommandBarResult[];
  loading?: boolean;
  onQueryChange?: (value: string) => void;
  onSelect?: (id: string) => void;
  className?: string;
}

function CommandBarResults({ results, loading, onSelect }: Pick<CommandBarProps, "results" | "loading" | "onSelect">) {
  if (loading) {
    return (
      <div className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Searching...
      </div>
    );
  }
  if (results.length === 0) {
    return (
      <div className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        No results.
      </div>
    );
  }
  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>
          <button
            type="button"
            onClick={() => onSelect?.(result.id)}
            className="w-full rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-left text-[length:var(--text-body)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
          >
            {result.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cmd-K palette shell (`components.md` "Command palette (Cmd-K) -- first-
 * class surface"): reserves `--z-command` above modals so it always renders
 * on top (F-D01: previously Cmd+K was a no-op with no dedicated layer).
 * Extracted from `components/shell/command-palette.tsx`, which owns the
 * keybinding, open state, and search fetch.
 */
export function CommandBar({ query, results, loading, onQueryChange, onSelect, className }: CommandBarProps) {
  return (
    <div
      role="dialog"
      aria-label="Global search"
      className={cn(
        "fixed left-1/2 top-[20vh] z-[var(--z-command)] w-full max-w-xl -translate-x-1/2",
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        "p-[var(--space-2)] shadow-[var(--shadow-overlay)]",
        className
      )}
    >
      <input
        autoFocus
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        placeholder="Search entities..."
        aria-label="Search entities"
        className="w-full border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] outline-none"
      />
      <CommandBarResults results={results} loading={loading} onSelect={onSelect} />
    </div>
  );
}
