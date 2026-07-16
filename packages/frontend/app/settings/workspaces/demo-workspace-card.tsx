"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Enters the caller's Hammerbarn practice sandbox (AC-8: workspace switching
 * lives here at Settings -> Workspaces, never a header switcher). Forking is
 * idempotent, so this doubles as "resume practice mode". Once forked, the
 * shell's PracticeModeBanner takes over (reset lives there). */
export function DemoWorkspaceCard() {
  const [inSandbox, setInSandbox] = useState<boolean | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/state")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { sandbox_forked_at: string | null } | null) => {
        if (!cancelled) setInSandbox(Boolean(body?.sandbox_forked_at));
      })
      .catch(() => {
        if (!cancelled) setInSandbox(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enter() {
    setEntering(true);
    const res = await fetch("/api/onboarding/sandbox", { method: "POST" }).catch(() => null);
    if (res?.ok) {
      window.location.assign("/dashboard");
      return;
    }
    setEntering(false);
  }

  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Hammerbarn demo
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          A safe, pre-modelled retail company to practice on. Explore, query, and edit freely — a reset
          restores it to the original demo, and nothing you do here touches your real workspace.
        </p>
        {inSandbox ? (
          <p data-testid="demo-active" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)]">
            You&apos;re in practice mode — use the banner at the top to reset the demo.
          </p>
        ) : (
          <div>
            <Button type="button" onClick={enter} disabled={inSandbox === null || entering}>
              {entering ? "Entering…" : "Enter practice mode"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
