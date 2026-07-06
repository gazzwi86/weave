import { Card, CardContent, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    title: "Model",
    body: "Describe your company once — people, processes, systems, data, rules — in the Constitution, your live company graph.",
  },
  {
    title: "Ask & see",
    body: "Query it in plain language, explore it visually, and watch answers ground themselves in the graph.",
  },
  {
    title: "Generate",
    body: "Build ships working, tested applications grounded in your model — code you own, on open standards.",
  },
];

const FEATURES = [
  { title: "Constitution", body: "The company graph: ontology, instances, versions, and query." },
  { title: "Build", body: "Request an application; a governed factory loop delivers it." },
  { title: "Events", body: "Event-to-action automations, from simple rules to agentic runs." },
  { title: "Explorer", body: "A force-directed canvas over everything your company is." },
  {
    title: "Audit & provenance",
    body: "Every human and agent action lands in an immutable, hash-chained trail.",
  },
  {
    title: "Open standards",
    body: "W3C semantic web stack, your repos, your code — no lock-in, ever.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="flex flex-col gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)]"
    >
      <h2 className="text-center text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        How it works
      </h2>
      <div className="mx-auto grid w-full max-w-5xl gap-[var(--space-4)] md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Card key={step.title}>
            <CardTitle>
              {index + 1}. {step.title}
            </CardTitle>
            <CardContent>
              <p className="text-[var(--color-text-muted)]">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="flex flex-col gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)]">
      <h2 className="text-center text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Four engines, one platform
      </h2>
      <div className="mx-auto grid w-full max-w-5xl gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardTitle>{feature.title}</CardTitle>
            <CardContent>
              <p className="text-[var(--color-text-muted)]">{feature.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
