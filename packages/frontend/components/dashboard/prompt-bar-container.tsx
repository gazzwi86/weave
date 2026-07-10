"use client";

import { useCallback, useState } from "react";

import { PromptBar } from "./prompt-bar";

const SESSION_KEY = "weave.dashboard.promptBarGeneratedCount";

function readGeneratedCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.sessionStorage.getItem(SESSION_KEY) ?? "0");
}

/** Owns the session-local "how many widgets has this user generated"
 * counter (AC-8's hide-after-3 threshold) and hands it to the stateless
 * `PromptBar`. Kept out of `PromptBar` itself so its tests don't share
 * mutable `sessionStorage` across cases (see prompt-bar.tsx comment).
 */
export function PromptBarContainer() {
  const [generatedCount, setGeneratedCount] = useState(readGeneratedCount);

  const bump = useCallback(() => {
    setGeneratedCount((prev) => {
      const next = prev + 1;
      window.sessionStorage.setItem(SESSION_KEY, String(next));
      return next;
    });
  }, []);

  return <PromptBar generatedCount={generatedCount} onWidgetGenerated={bump} />;
}
