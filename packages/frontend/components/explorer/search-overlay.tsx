import type { SearchResult } from "./use-search-overlay";

export interface SearchOverlayProps {
  open: boolean;
  query: string;
  results: SearchResult[];
  noResults: boolean;
  onQueryChange: (query: string) => void;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

export function SearchOverlay({ open, query, results, noResults, onQueryChange, onSelect, onClose }: SearchOverlayProps) {
  if (!open) return null;

  return (
    <div
      data-testid="explorer-search-overlay"
      className="absolute left-1/2 top-[var(--space-8)] z-[var(--z-overlay)] w-96 max-w-[calc(100%-var(--space-8))] -translate-x-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-overlay)]"
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <input
          autoFocus
          type="text"
          value={query}
          placeholder="Search nodes…"
          onChange={(event) => onQueryChange(event.target.value)}
          className="w-full bg-transparent text-[length:var(--text-body)] text-[var(--color-text-default)] outline-none"
        />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Close
        </button>
      </div>

      {noResults && (
        <p className="mt-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">No results found</p>
      )}

      {results.length > 0 && (
        <ul className="mt-[var(--space-3)] space-y-[var(--space-1)]">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => onSelect(result.id)}
                className="flex w-full items-baseline justify-between rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left hover:bg-[var(--color-hover)]"
              >
                <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{result.label}</span>
                <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{result.typeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
