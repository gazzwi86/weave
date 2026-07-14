// ponytail: placeholder company names, not real customer logos -- pre-launch
// product has no real customers to name yet; swap in real logos once it does
// (mirrors the Pricing section's existing "dummy tiers" treatment).
const PLACEHOLDER_COMPANIES = [
  "Acme Manufacturing",
  "Meridian Health",
  "Northwind Logistics",
  "Fenwick Legal",
];

/** Social-proof strip (IA §6 item 3) -- sits between hero and how-it-works. */
export function SocialProof() {
  return (
    <section
      aria-label="Social proof"
      className="flex flex-col items-center gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-5)]"
    >
      <p className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        Trusted by teams modelling how their company runs
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-[var(--space-6)]">
        {PLACEHOLDER_COMPANIES.map((name) => (
          <li
            key={name}
            className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-muted)]"
          >
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}
