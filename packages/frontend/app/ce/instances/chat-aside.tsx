"use client";

import { ChatPanel } from "../chat/chat-panel";
import { GlassAsidePage } from "@/components/templates/GlassAsidePage";

const QUICK_START_TEMPLATES = [
  "add a Process called...",
  "link this to a Business Capability",
  "rename this to...",
];

/** AC-8/AC-9: glass-panel restyle of the M1 chat -- presentational only,
 * the propose/confirm/reject mechanics are unchanged (`ChatPanel`/
 * `useCeChat`). Adds quick-start chips + clear-history (AC-8); the
 * provider-unavailable and can't-parse states are already inline chat
 * messages, so the browse/search table and guided form beside this aside
 * stay fully interactive by construction (AC-9, independent components).
 */
export function ChatAside() {
  return (
    <GlassAsidePage title="Ask">
      <ChatPanel quickStartTemplates={QUICK_START_TEMPLATES} showClearHistory />
    </GlassAsidePage>
  );
}
