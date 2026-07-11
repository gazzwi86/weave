import type { Attribution } from "./types";

const STORAGE_PREFIX = "weave:brand:attribution:";

/** ponytail: one localStorage key per entity IRI, not a single JSON blob --
 * mirrors the codebase's existing pattern for this exact class of problem
 * (chat history survives reload, `ce/chat/use-ce-chat.ts`). Session/
 * device-scoped only: another browser or user won't see it. That's the
 * honest ceiling -- see types.ts's `Attribution` docstring for why no
 * server-side per-item source exists to fall back to.
 */
export function recordAttribution(iri: string, attribution: Attribution): void {
  window.localStorage.setItem(`${STORAGE_PREFIX}${iri}`, JSON.stringify(attribution));
}

export function getAttribution(iri: string): Attribution | null {
  const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${iri}`);
  return raw ? (JSON.parse(raw) as Attribution) : null;
}
