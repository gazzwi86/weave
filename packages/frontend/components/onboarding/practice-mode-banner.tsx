"use client";

import { useEffect, useState } from "react";

interface SandboxState {
  sandbox_forked_at: string | null;
  sandbox_batch_semver: string | null;
}

type ResetPhase = "idle" | "confirming" | "resetting" | "error";

function ResetControls({
  phase,
  onAsk,
  onConfirm,
  onCancel,
}: {
  phase: ResetPhase;
  onAsk: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (phase === "resetting") {
    return <span className="text-[var(--color-text-muted)]">Resetting the demo…</span>;
  }
  if (phase === "confirming") {
    return (
      <>
        <span className="text-[var(--color-text-muted)]">Reset to the original demo?</span>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-[var(--radius-sm)] bg-[var(--color-accent-primary)] px-[var(--space-2)] py-[var(--space-1)] font-[var(--font-weight-semibold)] text-[var(--color-bg)]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          Cancel
        </button>
      </>
    );
  }
  return (
    <>
      {phase === "error" ? (
        <span className="text-[var(--color-danger)]">Reset failed — try again.</span>
      ) : null}
      <button
        type="button"
        onClick={onAsk}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--color-text-default)] hover:border-[var(--color-accent-primary)]"
      >
        Reset demo
      </button>
    </>
  );
}

/** ONB "Practice mode" UX: when the caller is in their forked Hammerbarn
 * sandbox (`sandbox_forked_at` set), a persistent banner marks the session as
 * a safe practice copy, shows the demo batch version, and offers a
 * blue/green reset (backend keeps it under ~30s). Renders nothing outside a
 * sandbox. ponytail: fetches state itself (the codebase pattern -- no shared
 * onboarding-state hook exists) rather than adding one for a single reader. */
export function PracticeModeBanner() {
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const [phase, setPhase] = useState<ResetPhase>("idle");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: SandboxState | null) => {
        if (!cancelled && body) setSandbox({ sandbox_forked_at: body.sandbox_forked_at, sandbox_batch_semver: body.sandbox_batch_semver });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sandbox?.sandbox_forked_at) return null;

  async function reset() {
    setPhase("resetting");
    const res = await fetch("/api/onboarding/sandbox/reset", { method: "POST" }).catch(() => null);
    if (res?.ok) {
      // Blue/green reset swapped the sandbox pointer -- reload so every open
      // view re-reads the freshly-seeded graph.
      window.location.reload();
      return;
    }
    setPhase("error");
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-[var(--space-3)] border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-body-sm)]"
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="font-[var(--font-weight-semibold)] text-[var(--color-accent-primary)]">Practice mode</span>
        <span className="text-[var(--color-text-muted)]">
          You&apos;re in a safe Hammerbarn demo workspace — changes here never touch your real model.
        </span>
        {sandbox.sandbox_batch_semver ? (
          <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[2px] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
            demo v{sandbox.sandbox_batch_semver}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <ResetControls
          phase={phase}
          onAsk={() => setPhase("confirming")}
          onConfirm={reset}
          onCancel={() => setPhase("idle")}
        />
      </div>
    </div>
  );
}
