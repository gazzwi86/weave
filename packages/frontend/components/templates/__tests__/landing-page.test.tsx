import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  LANDING_PAGE_SECTION_ORDER,
  LandingPageTemplate,
  type LandingPageSection,
} from "@/components/templates/landing-page";

function sectionsInOrder(): LandingPageSection[] {
  return LANDING_PAGE_SECTION_ORDER.map((kind) => ({
    kind,
    content: <div data-testid={`section-${kind}`}>{kind}</div>,
  }));
}

// AC-5 / test_landing_page_template_added_before_binding_content
describe("LandingPageTemplate", () => {
  it("should render the landing-page template with all nine sections present in the fixed order", () => {
    render(<LandingPageTemplate sections={sectionsInOrder()} />);
    for (const kind of LANDING_PAGE_SECTION_ORDER) {
      expect(screen.getByTestId(`section-${kind}`)).toBeInTheDocument();
    }
  });

  it("should throw when sections are out of the IA-fixed order", () => {
    const scrambled = [...sectionsInOrder()].reverse();
    expect(() => render(<LandingPageTemplate sections={scrambled} />)).toThrow(/IA order/);
  });
});
