import { Card, CardContent, CardTitle } from "@/components/ui/card";

import { CtaLink } from "./cta-link";

const TIERS = [
  {
    name: "Starter",
    price: "$49",
    unit: "per workspace / month",
    features: ["Constitution engine", "NL + SPARQL query", "5 members"],
  },
  {
    name: "Team",
    price: "$249",
    unit: "per workspace / month",
    features: ["Everything in Starter", "Build engine", "Audit trail exports", "25 members"],
  },
  {
    name: "Enterprise",
    price: "Talk to us",
    unit: "custom terms",
    features: ["Everything in Team", "Events & automations", "SSO + provisioning", "Unlimited members"],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="flex flex-col gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)]"
    >
      <h2 className="text-center text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Pricing
      </h2>
      <div className="mx-auto grid w-full max-w-5xl gap-[var(--space-4)] md:grid-cols-3">
        {TIERS.map((tier) => (
          <Card key={tier.name}>
            <CardTitle>{tier.name}</CardTitle>
            <CardContent className="flex flex-col gap-[var(--space-3)]">
              <p>
                <span className="text-[length:var(--text-h3)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
                  {tier.price}
                </span>{" "}
                <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
                  {tier.unit}
                </span>
              </p>
              <ul className="flex flex-col gap-[var(--space-1)] text-[var(--color-text-muted)]">
                {tier.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="flex flex-col items-center gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-6)] text-center">
      <h2 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Ready to model your company?
      </h2>
      <CtaLink href="/auth/login">Get started</CtaLink>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-[var(--color-border)] px-[var(--space-6)] py-[var(--space-4)]">
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        © 2026 Weave. All rights reserved.
      </p>
      <nav aria-label="Footer" className="flex gap-[var(--space-4)]">
        <a
          href="#how-it-works"
          className="text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Product
        </a>
        <a
          href="#pricing"
          className="text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Pricing
        </a>
      </nav>
    </footer>
  );
}
