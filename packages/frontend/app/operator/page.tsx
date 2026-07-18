import { auth } from "@/auth";
import { getSessionClaims, isPlatformOperator } from "@/lib/auth/session-claims";

import { OperatorConsole } from "./operator-console";

/** Platform-level, super-admin-only surface (refit-mock.html `#screen-operator`).
 * `isPlatformOperator` is the one place the super-admin check lives (see its
 * docblock) so this gate and the avatar-menu entry point can't drift apart. */
export default async function OperatorPage() {
  const session = await auth();
  const { role } = getSessionClaims(session?.accessToken);

  if (!isPlatformOperator(role)) {
    return (
      <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Operator console
        </h1>
        <p data-testid="operator-denied" className="text-[var(--color-text-muted)]">
          The operator console is available to platform operators only.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-[var(--space-6)]">
      <OperatorConsole />
    </main>
  );
}
