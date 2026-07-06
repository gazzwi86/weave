import { CtaLink } from "./cta-link";

/** Marketing header + hero (IA §6 items 1–3). The mock app panel stands in
 * for a product screenshot — pure CSS from tokens, no image payload, keeps
 * Lighthouse performance at 100. */
export function MarketingHeader() {
  return (
    <header className="flex items-center justify-between px-[var(--space-6)] py-[var(--space-4)]">
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        weave
      </p>
      <nav aria-label="Marketing" className="flex items-center gap-[var(--space-4)]">
        <a
          href="#how-it-works"
          className="text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Product
        </a>
        <a
          href="#pricing"
          className="text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Pricing
        </a>
        <CtaLink href="/auth/login" variant="ghost">
          Log in
        </CtaLink>
        <CtaLink href="/auth/login">Get started</CtaLink>
      </nav>
    </header>
  );
}

function MockGraphPanel() {
  const dots = [
    "var(--color-accent-primary)",
    "var(--color-success)",
    "var(--color-warn)",
    "var(--color-info)",
    "var(--color-kind-fallback)",
  ];
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-3xl items-center justify-center gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-6)] shadow-[var(--shadow-overlay)]"
    >
      {dots.map((color) => (
        <span
          key={color}
          className="inline-block h-[var(--space-4)] w-[var(--space-4)] rounded-[var(--radius-full)]"
          style={{ backgroundColor: color }}
        />
      ))}
      <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        people · processes · systems · data — one live graph
      </span>
    </div>
  );
}

export function Hero() {
  return (
    <section className="flex flex-col items-center gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)] text-center">
      <h1 className="max-w-3xl text-[length:var(--text-h1)] leading-[var(--text-h1-line)] tracking-[var(--text-h1-tracking)] font-[var(--font-weight-bold)] text-[var(--color-text-default)]">
        The operating system for the AI-native company
      </h1>
      <p className="max-w-2xl text-[length:var(--text-body-lg)] leading-[var(--text-body-lg-line)] text-[var(--color-text-muted)]">
        Model your business as a live knowledge graph, then generate the apps, agents, and
        automations that run it.
      </p>
      <div className="flex items-center gap-[var(--space-3)]">
        <CtaLink href="/auth/login">Get started</CtaLink>
        <CtaLink href="/auth/login" variant="ghost">
          Book a demo
        </CtaLink>
      </div>
      <MockGraphPanel />
    </section>
  );
}
