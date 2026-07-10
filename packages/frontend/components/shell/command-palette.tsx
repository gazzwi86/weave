"use client";

import { Command } from "cmdk";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SearchResultItem } from "./search-result-item";
import { useEntitySearch } from "./use-entity-search";

/** PR #13 finding (4): a search failure must read as "Search unavailable",
 * never the same "No results." shown for a real empty search. */
function SearchListEmptyState({ error }: { error: boolean }) {
  if (error) {
    return (
      <div className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        Search unavailable.
      </div>
    );
  }
  return (
    <Command.Empty className="px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
      No results.
    </Command.Empty>
  );
}

/** AC-2/3/4: Cmd+K (or Ctrl+K) opens the palette; typing 2+ chars queries
 * the tenant-scoped `/api/search` proxy; selecting a result navigates to
 * the (not-yet-built) resource detail route via client-side routing.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, error } = useEntitySearch(query);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // TASK-011 AC-8: the dashboard's own PromptBar owns Cmd+K there --
      // global search stays reachable via its trigger button, no double-bind.
      if (pathname?.startsWith("/dashboard")) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  function handleSelect(iri: string) {
    setOpen(false);
    router.push(`/ce/resource?iri=${encodeURIComponent(iri)}`);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search"
      shouldFilter={false}
      className="fixed left-1/2 top-[20vh] w-full max-w-[560px] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-2)] shadow-[var(--shadow-overlay)]"
    >
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search entities…"
        className="w-full border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] outline-none"
      />
      <Command.List>
        <SearchListEmptyState error={error} />
        {results.map((result) => (
          <SearchResultItem key={result.iri} result={result} onSelect={handleSelect} />
        ))}
      </Command.List>
    </Command.Dialog>
  );
}
