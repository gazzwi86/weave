import { render, screen } from "@testing-library/react";
import { userEvent } from "storybook/test";
import { describe, expect, it, vi } from "vitest";

import { HelpPanel, type HelpCardItem } from "../HelpPanel";

const CARDS: HelpCardItem[] = [
  { icon: "play", title: "Guided tour", subtitle: "3 minutes", onClick: vi.fn() },
  { icon: "book", tone: "purple", title: "Docs & concepts", subtitle: "Kinds, versions, publishing", href: "/ce/glossary" },
  { icon: "msg", tone: "green", title: "Contact support", subtitle: "We reply within a business day", href: "mailto:support@weave.app" },
];

describe("HelpPanel", () => {
  it("renders a Get going card per entry, as a button when onClick-driven", async () => {
    const onClick = vi.fn();
    render(<HelpPanel cards={[{ icon: "play", title: "Guided tour", subtitle: "3 minutes", onClick }]} />);
    const button = screen.getByRole("button", { name: /guided tour/i });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders an href-driven card as a real link", () => {
    render(<HelpPanel cards={CARDS} />);
    expect(screen.getByRole("link", { name: /docs & concepts/i })).toHaveAttribute("href", "/ce/glossary");
  });

  it("renders the real keyboard shortcuts by default", () => {
    render(<HelpPanel cards={[]} />);
    expect(screen.getByText("⌘K")).toBeInTheDocument();
    expect(screen.getByText("Esc")).toBeInTheDocument();
    expect(screen.getByText("⌘\\")).toBeInTheDocument();
  });

  it("places the wrapper's closeSlot in the header", () => {
    render(<HelpPanel cards={[]} closeSlot={<button aria-label="Close help">x</button>} />);
    expect(screen.getByRole("button", { name: "Close help" })).toBeInTheDocument();
  });

  it("renders wrapper-supplied children between the cards and the keyboard section", () => {
    render(
      <HelpPanel cards={[]}>
        <p>Legacy help content</p>
      </HelpPanel>
    );
    expect(screen.getByText("Legacy help content")).toBeInTheDocument();
  });

  it("omits the Get going section entirely when there are no cards", () => {
    render(<HelpPanel cards={[]} />);
    expect(screen.queryByText("Get going")).not.toBeInTheDocument();
  });
});
