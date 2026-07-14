const SHOTS = [
  { src: "/marketing/screenshot-band-dashboard.png", alt: "Weave dashboard showing workflow and task metrics" },
  { src: "/marketing/screenshot-band-table.png", alt: "Weave table view of workspace records" },
];

/** Screenshot band (IA §6 item 6) -- sits between feature grid and pricing. */
export function ScreenshotBand() {
  return (
    <section
      aria-label="Product screenshots"
      className="flex flex-col items-center gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-6)]"
    >
      <div className="mx-auto grid w-full max-w-5xl gap-[var(--space-4)] md:grid-cols-2">
        {SHOTS.map((shot) => (
          // eslint-disable-next-line @next/next/no-img-element -- static marketing asset, no next/image optimisation needed
          <img
            key={shot.src}
            src={shot.src}
            alt={shot.alt}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)]"
          />
        ))}
      </div>
    </section>
  );
}
