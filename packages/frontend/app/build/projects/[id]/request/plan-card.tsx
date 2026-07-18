import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

/** refit-mock.html `#sub-bld-studio` `.side-card` "Proposed plan" -- each
 * `draft_content` section (a name -> drafted-text map, see
 * `requests/pipeline.py`) becomes one numbered step. Approve/Estimate stay
 * disabled: `POST .../sign-off` and `GET .../cost-estimate` exist on the
 * backend (`routers/request_governance.py`) but have no frontend proxy yet
 * -- gap G13, same "no phase pills, unbuilt = disabled + soon" convention
 * as the sidebar's nav tags (see `feedback_no_phase_pills.md`). Wiring them
 * is a feature task, not this data-binding refit (sign-off in particular
 * auto-creates a project and enforces a cost cap -- not safe to half-wire).
 */
export function PlanCard({ draftContent }: { draftContent: Record<string, unknown> | null }): React.JSX.Element {
  const sections = draftContent ? Object.entries(draftContent) : [];

  return (
    <Card data-testid="plan-card">
      <CardTitle>Proposed plan</CardTitle>
      {sections.length === 0 ? (
        <p className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          Plan pending — drafting in progress.
        </p>
      ) : (
        <ol className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
          {sections.map(([key, value], i) => (
            <li key={key} className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
              <b>
                {i + 1} · {key}
              </b>
              <p className="text-[var(--color-text-muted)]">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
        <Button disabled title="Sign-off isn't wired up yet (gap G13)">
          Approve plan — soon
        </Button>
        <Button variant="secondary" disabled title="Cost estimate isn't wired up yet (gap G13)">
          Estimate — soon
        </Button>
      </div>
    </Card>
  );
}
