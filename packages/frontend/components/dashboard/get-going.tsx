import { HelpCard } from "@/components/organisms/HelpPanel";
import { Eyebrow } from "@/components/ui/eyebrow";

import { GuidedTourCard } from "./guided-tour-card";

/** v5 Home "Get going" side-card: guided tour (client, starts the shared
 * ce-overview driver.js tour) + two static nav cards, all composing
 * `HelpCard` from the help-flyout organism rather than a bespoke card. */
export function GetGoing() {
  return (
    <section
      aria-label="Get going"
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <h2 className="mb-[var(--space-2)]">
        <Eyebrow as="span">Get going</Eyebrow>
      </h2>
      <div className="flex flex-col gap-[var(--space-2)]">
        <GuidedTourCard />
        <HelpCard
          card={{
            icon: "sparkles",
            tone: "purple",
            title: "Ask your first question",
            subtitle: "“who owns order handling?”",
            href: "/ce/query",
          }}
        />
        <HelpCard
          card={{
            icon: "user",
            tone: "green",
            title: "Tune your path",
            subtitle: "tours & tips match how you use Weave",
            href: "/settings/onboarding-path",
          }}
        />
      </div>
    </section>
  );
}
