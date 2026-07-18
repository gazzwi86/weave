"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { useOnboardingPath, type RolePath } from "./use-onboarding-path";

interface PathCardDef {
  rolePath: RolePath;
  title: string;
  description: string;
  icon: IconName;
  swatchClass: string;
}

// refit-mock.html #sub-set-onboarding: 4 kind-tiles, one per RolePath. Card
// copy/order comes straight from the mock; it doesn't textually match
// ROLE_PATH_LABELS (those are short nav labels, not this page's pitch), so
// the mapping is spelled out here rather than derived.
const PATH_CARDS: PathCardDef[] = [
  {
    rolePath: "business",
    title: "Model the business",
    description: "You shape the Constitution — kinds, entities, rules, publishing.",
    icon: "graph",
    swatchClass: "bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)]",
  },
  {
    rolePath: "technical",
    title: "Build with Weave",
    description: "You request apps and automations, review plans and gates.",
    icon: "layers",
    swatchClass: "bg-[var(--color-kind-system)]/15 text-[var(--color-kind-system)]",
  },
  {
    rolePath: "admin",
    title: "Operate & approve",
    description: "You run day-to-day work and clear review gates fast.",
    icon: "check",
    swatchClass: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  },
  {
    rolePath: "compliance",
    title: "Observe & audit",
    description: "You watch compliance, the audit trail and governance health.",
    icon: "shield",
    swatchClass: "bg-[var(--color-kind-policy)]/15 text-[var(--color-kind-policy)]",
  },
];

// mock's #sub-set-onboarding "Restart the guided tour" button. There's no
// single "the tour" concept server-side (TOURS has one per area) -- this
// binds to the platform-wide tour (tour.plat.role-home, the one a new user
// sees on role-home) by resetting its stored progress via the real, already-
// shipped tour-progress endpoint. It only resets server state; re-playing it
// happens next time role-home's beacon/welcome-modal starts it (unchanged).
const PLATFORM_TOUR_ID = "tour.plat.role-home";

async function resetPlatformTour(): Promise<boolean> {
  const res = await fetch(`/api/onboarding/tours/${PLATFORM_TOUR_ID}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ last_completed_step: 0, completed: false, skipped: false }),
  });
  return res.ok;
}

function PathCard({ card, current, onSelect }: { card: PathCardDef; current: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] border p-[var(--space-4)] text-left",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        current
          ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-soft)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]"
      )}
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span className={cn("inline-flex h-[var(--space-6)] w-[var(--space-6)] items-center justify-center rounded-[var(--radius-base)]", card.swatchClass)}>
          <Icon name={card.icon} size={14} />
        </span>
        <span className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {card.title}
        </span>
        {current && (
          <span className="ml-auto rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]/20 px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-accent-primary)]">
            current
          </span>
        )}
      </div>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{card.description}</p>
    </button>
  );
}

function RestartTourButton() {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)] items-start">
      <button
        type="button"
        onClick={() => {
          resetPlatformTour().then((ok) => setStatus(ok ? "Tour progress reset." : "Unable to reset the tour."));
        }}
        className="inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-default)]"
      >
        <Icon name="play" size={12} />
        Restart the guided tour
      </button>
      {status && (
        <p role="status" className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {status}
        </p>
      )}
    </div>
  );
}

/** Settings -> Onboarding path (mock's `#sub-set-onboarding`): a 4-card grid,
 * click-to-switch with a "current" badge, bound to `useOnboardingPath()`
 * (AC-006-04). Replaces the old dialog-based picker.
 */
export function OnboardingPathCards() {
  const { path, loadError, changePath } = useOnboardingPath();

  if (loadError) {
    return (
      <p data-testid="onboarding-path-error" className="text-[var(--color-text-muted)]">
        Couldn&apos;t load your onboarding path.
      </p>
    );
  }
  if (!path) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
        {PATH_CARDS.map((card) => (
          <PathCard
            key={card.rolePath}
            card={card}
            current={card.rolePath === path.role_path}
            onSelect={() => {
              if (card.rolePath !== path.role_path) changePath(card.rolePath);
            }}
          />
        ))}
      </div>
      <RestartTourButton />
    </div>
  );
}
