import { OnboardingPathCards } from "./onboarding-path-cards";

/** Settings -> Onboarding path (mock's `#sub-set-onboarding`, ONB-TASK-006
 * AC-006-04): "change my onboarding path" as a 4-card grid.
 */
export default function OnboardingPathSettingsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Onboarding path
      </h1>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Tours and tips are tuned to how you use Weave. Switch any time.
      </p>
      <OnboardingPathCards />
    </main>
  );
}
