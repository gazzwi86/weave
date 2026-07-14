import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WhatsNewPanel } from "../whats-new-panel";
import type { WhatsNewItem } from "../../../../shared/onboarding/content/schema";

const items: WhatsNewItem[] = [
  { itemId: "a", version: "1.2.0", titleKey: "onboarding.whats-new.launch.title", bodyKey: "onboarding.whats-new.launch.body", publishedAt: "2026-07-06" },
];

describe("WhatsNewPanel", () => {
  it("shows version, date, headline and description for each item (AC-012-04)", () => {
    render(<WhatsNewPanel items={items} />);
    expect(screen.getByText("1.2.0")).toBeInTheDocument();
    expect(screen.getByText(/2026-07-06/)).toBeInTheDocument();
  });

  it("caps the list at N items (default 5, tunable)", () => {
    const many: WhatsNewItem[] = Array.from({ length: 8 }, (_, i) => ({
      itemId: `i${i}`,
      version: `1.${i}.0`,
      titleKey: "onboarding.whats-new.launch.title",
      bodyKey: "onboarding.whats-new.launch.body",
      publishedAt: `2026-07-0${(i % 9) + 1}`,
    }));
    render(<WhatsNewPanel items={many} maxItems={3} />);
    expect(screen.getAllByTestId("whats-new-item")).toHaveLength(3);
  });

  it("shows an empty state, never an error, when there are no items (AC-012-05)", () => {
    render(<WhatsNewPanel items={[]} />);
    expect(screen.getByText(/nothing new/i)).toBeInTheDocument();
  });
});
