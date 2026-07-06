import { describe, expect, it } from "vitest";

import { stripLangTag } from "../strip-lang-tag";

// Implementation Hints: rdfs:label values may carry an "@lang" tag; the
// side panel must never surface it.
describe("stripLangTag", () => {
  it("strips a two-letter language tag ('label'@en -> 'label')", () => {
    expect(stripLangTag("Customer Onboarding@en")).toBe("Customer Onboarding");
  });

  it("strips a region-qualified language tag ('label'@en-US -> 'label')", () => {
    expect(stripLangTag("Customer Onboarding@en-US")).toBe("Customer Onboarding");
  });

  it("leaves a value with no language tag unchanged", () => {
    expect(stripLangTag("Customer Onboarding")).toBe("Customer Onboarding");
  });

  it("does not strip an '@' that is not a trailing language tag", () => {
    expect(stripLangTag("Contact: sales@example.com")).toBe("Contact: sales@example.com");
  });
});
