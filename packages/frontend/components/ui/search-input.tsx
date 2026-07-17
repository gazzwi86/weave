import { cn } from "@/lib/utils";

import { Icon } from "./icon";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** refit-mock.html `.search-input` -- icon + borderless input inside a
 * bordered shell, accent glow on focus-within (reuses the same accent ring
 * as Input's own focus-visible state). */
export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[var(--space-2)] rounded-[var(--radius-base)] border border-[var(--color-border-strong)]",
        "bg-[var(--color-raised)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-subtle)]",
        "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        "focus-within:border-[var(--color-accent-primary)] focus-within:shadow-[var(--ring-focus)]",
        className
      )}
    >
      <Icon name="search" size={14} />
      <input
        type="text"
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[length:var(--text-body-sm)] text-[var(--color-text-default)] outline-none placeholder:text-[var(--color-text-subtle)]"
      />
    </div>
  );
}
