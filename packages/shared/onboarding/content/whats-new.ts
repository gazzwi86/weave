import { WhatsNewItemSchema, type WhatsNewItem } from "./schema";

const items: WhatsNewItem[] = [
  {
    itemId: "launch",
    titleKey: "onboarding.whats-new.launch.title",
    bodyKey: "onboarding.whats-new.launch.body",
    publishedAt: "2026-07-06",
  },
];

export const WHATS_NEW_ITEMS: WhatsNewItem[] = items.map((i) => WhatsNewItemSchema.parse(i));
