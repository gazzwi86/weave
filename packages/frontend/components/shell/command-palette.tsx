"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PRIMARY_NAV } from "./nav-items";
import { SearchResultItem } from "./search-result-item";
import { useEntitySearch } from "./use-entity-search";

/** AC-3: Navigation group -- client-filtered against the static IA (no
 * network call), matched on substring so a partial area name still surfaces
 * it (e.g. "constit" -> "Constitution"). */
function matchingNavItems(query: string) {
  if (query.length === 0) return [];
  const needle = query.toLowerCase();
  return PRIMARY_NAV.filter((item) => item.label.toLowerCase().includes(needle));
}

/** AC-3: Actions group -- a minimal, always-available action set. Extend
 * here as more global actions are needed; not a general command registry
 * (YAGNI -- no scenario in the brief calls for one). */
const ACTIONS = [{ id: "sign-out", label: "Sign out", href: "/api/auth/signout" }];

function matchingActions(query: string) {
  if (query.length === 0) return [];
  const needle = query.toLowerCase();
  return ACTIONS.filter((action) => action.label.toLowerCase().includes(needle));
}

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

interface CommandGroupsProps {
  navItems: ReturnType<typeof matchingNavItems>;
  results: ReturnType<typeof useEntitySearch>["results"];
  actions: ReturnType<typeof matchingActions>;
  error: boolean;
  onSelectHref: (href: string) => void;
  onSelectEntity: (iri: string) => void;
}

/** AC-3: the three result groups (Navigation / Entities / Actions), split
 * out so `CommandPalette` itself stays under the function-length budget. */
function CommandGroups({ navItems, results, actions, error, onSelectHref, onSelectEntity }: CommandGroupsProps) {
  const hasNoResults = navItems.length === 0 && actions.length === 0 && results.length === 0;
  return (
    <Command.List>
      {hasNoResults ? <SearchListEmptyState error={error} /> : null}
      {navItems.length > 0 ? (
        <Command.Group heading="Navigation">
          {navItems.map((item) => (
            <Command.Item key={item.href} value={`nav-${item.href}`} onSelect={() => onSelectHref(item.href)}>
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>
      ) : null}
      {results.length > 0 ? (
        <Command.Group heading="Entities">
          {results.map((result) => (
            <SearchResultItem key={result.iri} result={result} onSelect={onSelectEntity} />
          ))}
        </Command.Group>
      ) : null}
      {actions.length > 0 ? (
        <Command.Group heading="Actions">
          {actions.map((action) => (
            <Command.Item key={action.id} value={`action-${action.id}`} onSelect={() => onSelectHref(action.href)}>
              {action.label}
            </Command.Item>
          ))}
        </Command.Group>
      ) : null}
    </Command.List>
  );
}

/** AC-3: Cmd+K (or Ctrl+K) toggles `open`, from anywhere in the app. */
function useCommandPaletteHotkey(setOpen: (updater: (prev: boolean) => boolean) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
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
  useCommandPaletteHotkey(setOpen);

  function handleSelectEntity(iri: string) {
    setOpen(false);
    router.push(`/ce/resource?iri=${encodeURIComponent(iri)}`);
  }

  function handleSelectHref(href: string) {
    setOpen(false);
    router.push(href);
  }

  const navItems = matchingNavItems(query);
  const actions = matchingActions(query);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search"
      shouldFilter={false}
      // AC-3: --z-command (above modals) + the palette's signature
      // gradient-border brand moment (components.md "Command palette").
      // `contentClassName` targets the Radix Dialog.Content (role="dialog")
      // element -- `className` alone lands on the inner Command root, not
      // the dialog container.
      contentClassName="fixed left-1/2 top-[20vh] z-[var(--z-command)] w-full max-w-[560px] -translate-x-1/2 rounded-[var(--radius-lg)] border border-transparent bg-[var(--color-surface)] bg-clip-padding p-[var(--space-2)] shadow-[var(--shadow-overlay)] [background-image:linear-gradient(var(--color-surface),var(--color-surface)),var(--gradient-accent)] [background-origin:border-box] [background-clip:padding-box,border-box]"
    >
      <Command.Input
        autoFocus
        value={query}
        onValueChange={setQuery}
        placeholder="Search entities…"
        className="w-full border-none bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] outline-none"
      />
      <CommandGroups
        navItems={navItems}
        results={results}
        actions={actions}
        error={error}
        onSelectHref={handleSelectHref}
        onSelectEntity={handleSelectEntity}
      />
      <p className="mt-[var(--space-2)] px-[var(--space-3)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        ↑↓ to navigate · Enter to select · Esc to dismiss
      </p>
    </Command.Dialog>
  );
}
