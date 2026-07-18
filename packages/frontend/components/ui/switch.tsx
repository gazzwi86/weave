import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Toggle switch -- tokenised checkbox, shared by Notifications' in-app
 * toggles and General's Appearance card. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <input
      type="checkbox"
      className={cn(
        "relative h-[var(--space-4)] w-[var(--space-6)] shrink-0 cursor-pointer appearance-none rounded-[var(--radius-full)] border",
        "border-[var(--color-border-strong)] bg-[var(--color-overlay)] transition-colors duration-[var(--duration-fast)]",
        "checked:border-[var(--color-accent-primary)] checked:bg-[var(--color-accent-soft)]",
        "after:absolute after:left-[calc(var(--space-1)/2)] after:top-[calc(var(--space-1)/2)]",
        "after:h-[calc(var(--space-4)-var(--space-1))] after:w-[calc(var(--space-4)-var(--space-1))] after:rounded-[var(--radius-full)]",
        "after:bg-[var(--color-text-subtle)] after:transition-[left] after:duration-[var(--duration-fast)]",
        "checked:after:left-[calc(var(--space-4)+var(--space-1)/2)] checked:after:bg-[var(--color-accent-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}
