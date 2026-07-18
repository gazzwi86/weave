"use client";

import { useEffect, useSyncExternalStore } from "react";

const COLLAPSE_STORAGE_KEY = "weave.sectionRail.collapsed";

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** AC-1: secondary-sidebar collapse state, persisted per browser profile
 * (stands in for "per-user" without a new backend surface). Shared by the
 * sidebar itself and the top-bar expand affordance -- toggle dispatches a
 * synthetic StorageEvent so every mounted instance re-reads in the same tab
 * (native storage events only fire cross-tab). getServerSnapshot reports
 * "expanded" so SSR and first client render agree (no hydration mismatch),
 * then the real localStorage value takes over. Only the exact string "true"
 * counts as collapsed -- a corrupt/foreign value reads as expanded. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeToStorage,
    () => window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true",
    () => false
  );

  const toggle = () => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(!collapsed));
    window.dispatchEvent(new StorageEvent("storage"));
  };

  return [collapsed, toggle];
}

/** refit-mock.html's "Toggle sidebar" shortcut: Cmd+\ (or Ctrl+\), from
 * anywhere. Bind once at the shell root -- `toggle` already flips whatever
 * the current state is, so a single global listener is correct regardless
 * of which component happens to be mounted. */
export function useSidebarCollapseHotkey(toggle: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);
}
