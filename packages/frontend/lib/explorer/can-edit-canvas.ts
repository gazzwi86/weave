const EDITOR_ROLES = new Set(["BA", "ontologist"]);

/** TASK-023 AC-7 (UX layer only -- hiding edit affordances is never the
 * security boundary; CE-WRITE-1 independently rejects server-side). Owns
 * the shared canvas-mode flag (brief: "whichever lands first builds it") --
 * `isDraftCanvas` defaults `true` by every caller today since no
 * published-version pin exists yet; CE-V1-TASK-022 flips it `false` once it
 * lands, with no change needed here. */
export function canEditCanvas(ctx: { role: string | null; isDraftCanvas: boolean }): boolean {
  return ctx.isDraftCanvas && ctx.role !== null && EDITOR_ROLES.has(ctx.role);
}
