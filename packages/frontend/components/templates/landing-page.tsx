import type { ReactNode } from "react";

/** Fixed section order (`poc-ia-proposal.md` §6) -- normative, not a
 * convention. AC-2. */
export const LANDING_PAGE_SECTION_ORDER = [
  "header",
  "hero",
  "social-proof",
  "how-it-works",
  "feature-grid",
  "screenshot-band",
  "pricing",
  "final-cta",
  "footer",
] as const;

export type LandingPageSectionKind = (typeof LANDING_PAGE_SECTION_ORDER)[number];

export interface LandingPageSection {
  kind: LandingPageSectionKind;
  content: ReactNode;
}

export interface LandingPageProps {
  sections: LandingPageSection[];
}

function assertSectionOrder(sections: LandingPageSection[]): void {
  const actual = sections.map((section) => section.kind).join(",");
  const expected = LANDING_PAGE_SECTION_ORDER.join(",");
  if (actual !== expected) {
    throw new Error(`LandingPageTemplate: sections must match IA order [${expected}], got [${actual}]`);
  }
}

/**
 * Marketing/landing page shell (`poc-ia-proposal.md` §6, R13 atomic-design
 * constraint). Data-only props -- the caller supplies each section's
 * already-rendered content; this template only enforces the fixed
 * nine-section order and lays out header/main/footer.
 */
export function LandingPageTemplate({ sections }: LandingPageProps) {
  assertSectionOrder(sections);
  const [header, ...rest] = sections;
  const footer = rest.pop();

  return (
    <div className="flex min-h-screen flex-col">
      {header?.content}
      <main className="flex-1">
        {rest.map((section) => (
          <div key={section.kind}>{section.content}</div>
        ))}
      </main>
      {footer?.content}
    </div>
  );
}
