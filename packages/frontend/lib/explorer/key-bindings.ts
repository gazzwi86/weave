/** AC-7: Cmd/Ctrl+0 fits the canvas, but only when the canvas container
 * holds focus -- never a global capture that steals the shortcut from a
 * search box or other input elsewhere on the page.
 *
 * Cmd/Ctrl+K (command palette) is deferred to TASK-003 (SearchOverlay). */
export interface KeyBindableCy {
  container(): HTMLElement | null;
  fit(): void;
}

function isFitShortcut(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && event.key === "0";
}

export function registerKeyBindings(cy: KeyBindableCy): () => void {
  const handler = (event: KeyboardEvent): void => {
    const container = cy.container();
    if (!container || !container.contains(document.activeElement)) return;
    if (!isFitShortcut(event)) return;
    event.preventDefault();
    cy.fit();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
