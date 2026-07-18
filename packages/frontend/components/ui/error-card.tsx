import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Icon } from "./icon";

export interface ErrorCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  body: string;
  onRetry?: () => void;
}

/** refit-mock.html `.error-card` -- inline danger card for a failed
 * operation (e.g. a query timeout), distinct from Toast (transient) and
 * ConfirmDialog (blocking). `role="alert"` since it always represents a
 * failure the user needs to know about. Forwards `...rest` (e.g.
 * `data-testid`) onto the root so callers can address a specific card
 * without inventing a second identity for the same element. */
export function ErrorCard({ title, body, onRetry, className, ...rest }: ErrorCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        "mt-[var(--space-3)] flex items-start gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 p-[var(--space-4)]",
        className
      )}
      {...rest}
    >
      <span className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
        <Icon name="alert-triangle" size={15} />
      </span>
      <div className="flex-1 text-[length:var(--text-body-sm)] leading-relaxed text-[var(--color-text-muted)]">
        <b className="mb-[var(--space-1)] block text-[var(--color-text-default)]">{title}</b>
        {body}
      </div>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
