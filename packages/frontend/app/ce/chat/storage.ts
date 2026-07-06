import type { ChatMessage } from "./types";

// Versioned key: a future schema change bumps the suffix rather than
// crashing on old stored data (ponytail: no migration needed, old key is
// just abandoned).
const STORAGE_KEY = "weave:ce:chat:v1";

/** TASK-006 AC-006-05: restores conversation history from in-browser
 * (localStorage) persistence after a page reload. Corrupt/unavailable
 * storage degrades to an empty history rather than throwing.
 */
export function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ponytail: quota/serialization failure -- history persistence is
    // best-effort and must never block the chat itself.
  }
}
