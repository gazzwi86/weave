import { useState } from "react";

import type { BuildRequest } from "./use-request-status";

/** One turn of the studio conversation: the prompt the user sent, plus a
 * frozen snapshot of the request once a newer turn supersedes it (the AI
 * side only ever tracks the *current* request live -- see thread.tsx). */
export interface Turn {
  prompt: string;
  snapshot: BuildRequest | null;
}

/** Tracks the studio's turn history. `startTurn` freezes whatever the live
 * request looked like for the previous turn, then opens a new live turn --
 * split out of `page.tsx` to keep `BuildPage` under the function-length
 * budget (Law E). */
export function useStudioThread(liveRequest: BuildRequest | null): {
  turns: Turn[];
  startTurn: (prompt: string) => void;
} {
  const [turns, setTurns] = useState<Turn[]>([]);

  function startTurn(prompt: string) {
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (!last) {
        return [{ prompt, snapshot: null }];
      }
      const frozenLast: Turn = { prompt: last.prompt, snapshot: liveRequest };
      return [...prev.slice(0, -1), frozenLast, { prompt, snapshot: null }];
    });
  }

  return { turns, startTurn };
}
