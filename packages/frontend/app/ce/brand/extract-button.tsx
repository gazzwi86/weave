"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** AC-004-04: the extraction affordance always 503s today (E4-S2 is
 * Should-Have/deferred, `api/proxy/brand/extract` is a permanent stub until
 * then) -- clicking it shows that state without disabling the forms around
 * it (FR-024 degradation is additive, not blocking).
 */
export function ExtractButton() {
  const [unavailable, setUnavailable] = useState(false);

  async function handleClick(): Promise<void> {
    const res = await fetch("/api/proxy/brand/extract", { method: "POST" });
    setUnavailable(res.status === 503);
  }

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <Button variant="secondary" onClick={() => void handleClick()}>
        Extract from source (AI)
      </Button>
      {unavailable && (
        <p className="text-[length:var(--text-small)] text-[var(--color-text-muted)]">
          Extraction isn&apos;t available yet -- use the form below instead.
        </p>
      )}
    </div>
  );
}
