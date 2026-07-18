import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { Icon } from "@/components/ui/icon";

import { HelpPanel, type HelpCardItem } from "./HelpPanel";

const meta: Meta<typeof HelpPanel> = {
  title: "Organisms/HelpPanel",
  component: HelpPanel,
};
export default meta;

type Story = StoryObj<typeof HelpPanel>;

const CARDS: HelpCardItem[] = [
  { icon: "play", title: "Guided tour", subtitle: "3 minutes — overview, glossary, query, rules", onClick: fn() },
  {
    icon: "book",
    tone: "purple",
    title: "Docs & concepts",
    subtitle: "What is the Constitution? Kinds, versions, publishing",
    href: "/ce/glossary",
  },
  {
    icon: "msg",
    tone: "green",
    title: "Contact support",
    subtitle: "We reply within a business day",
    href: "mailto:support@weave.app",
  },
];

export const Default: Story = { args: { cards: CARDS } };
export const DefaultDark: Story = { ...Default, parameters: { theme: "dark" } };

// refit-mock.html's flyout-head close slot -- the wrapper supplies the real
// Dialog.Close element, HelpPanel only places it (see closeSlot doc).
export const WithCloseSlot: Story = {
  args: {
    ...Default.args,
    closeSlot: (
      <button type="button" aria-label="Close help" className="flex h-[26px] w-[26px] items-center justify-center">
        <Icon name="x" size={14} />
      </button>
    ),
  },
};

// Legacy functional help content (contextual links, tour deep-links,
// show-hints/training/change-path) slots between "Get going" and "Keyboard".
export const WithLegacyContent: Story = {
  args: {
    cards: CARDS,
    children: (
      <nav aria-label="Help topics" className="flex flex-col gap-[var(--space-2)]">
        <a href="/ce" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
          Model your company — add Processes, Actors, Goals in the Constitution
        </a>
      </nav>
    ),
  },
};

// Coverage: the Guided tour card is a real button that fires its handler.
export const Interactive: Story = {
  args: { cards: CARDS },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /guided tour/i }));
    expect((args.cards[0] as HelpCardItem).onClick).toHaveBeenCalledTimes(1);
  },
};
