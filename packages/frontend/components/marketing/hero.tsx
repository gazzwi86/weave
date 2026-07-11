import { CtaLink } from "./cta-link";

/** Marketing header + hero (IA §6 items 1–3). */
export function MarketingHeader() {
  return (
    <header className="flex items-center justify-between px-[var(--space-6)] py-[var(--space-4)]">
      {/* AC-4: full logo lockup asset (generated from logo.png), never the
       * raw padded PNG resized via CSS height. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no next/image optimisation needed */}
      <img src="/logo-lockup.png" alt="Weave" className="h-[28px] w-auto" />
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
      {/* AC-1: real product screenshot, replacing the CSS MockGraphPanel. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static marketing asset, no next/image optimisation needed */}
      <img
        src="/marketing/hero-canvas.png"
        alt="Weave Explorer graph canvas — processes, actors, systems, and data connected in one live company graph"
        className="mx-auto w-full max-w-3xl rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-overlay)]"
      />
    </section>
  );
}
