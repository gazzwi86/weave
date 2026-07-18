"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface TypeaheadOption {
  value: string;
  label: string;
  /** Mono sub-row under the label, e.g. a URN (refit-mock.html `.ta-row .urn`). */
  sub?: string;
}

export interface TypeaheadFieldProps {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: TypeaheadOption[];
  /** Dropdown open state -- controlled by the caller (three static stories:
   * closed/open/picked, no play function needed to demonstrate open). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (option: TypeaheadOption) => void;
  placeholder?: string;
  className?: string;
}

const INPUT_CLASS =
  "h-[var(--space-6)] w-full rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-raised)] px-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] focus:border-[var(--color-accent-primary)] focus:shadow-[0_0_0_3px_var(--color-accent-soft)]";

function optionId(id: string, index: number): string {
  return `${id}-option-${index}`;
}

/** Resets the highlighted index to 0 whenever `open` flips to true. Uses
 * React's render-time "adjust state when a prop changes" pattern (not an
 * effect) to avoid the cascading-render lint rule. */
function useResetHighlightOnOpen(open: boolean, setHighlighted: (updater: (h: number) => number) => void) {
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setHighlighted(() => 0);
  }
}

/** Outside-click close, scoped to a container ref. */
function useOutsideClick(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [ref, onOutside]);
}

function useTypeaheadKeyboard({
  open,
  options,
  highlighted,
  setHighlighted,
  onClose,
  onPick,
}: {
  open: boolean;
  options: TypeaheadOption[];
  highlighted: number;
  setHighlighted: (updater: (h: number) => number) => void;
  onClose: () => void;
  onPick: (option: TypeaheadOption) => void;
}) {
  return function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" && open && options[highlighted]) {
      event.preventDefault();
      onPick(options[highlighted]);
    } else if (event.key === "Escape") {
      onClose();
    }
  };
}

function TypeaheadDropdown({
  id,
  options,
  highlighted,
  onPick,
}: {
  id: string;
  options: TypeaheadOption[];
  highlighted: number;
  onPick: (option: TypeaheadOption) => void;
}) {
  return (
    <ul
      id={`${id}-listbox`}
      role="listbox"
      className="absolute top-[calc(100%+var(--space-1))] left-0 right-0 z-[var(--z-overlay)] max-h-[var(--size-picker-list-max)] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] shadow-[var(--shadow-overlay)]"
    >
      {options.map((option, index) => (
        <li
          key={option.value}
          id={optionId(id, index)}
          role="option"
          aria-selected={index === highlighted}
          onMouseDown={() => onPick(option)}
          className={cn(
            "flex cursor-pointer flex-col gap-[var(--space-1)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]",
            index === highlighted && "bg-[var(--color-hover)] text-[var(--color-text-default)]"
          )}
        >
          {option.label}
          {option.sub && (
            <span
              className={cn(
                "font-[var(--font-mono)] text-[length:var(--text-caption)]",
                // `text-subtle` fails WCAG AA contrast against the highlighted
                // row's `--color-hover` background in the light theme (4.23:1
                // vs 4.5:1 required); bump to `text-muted` when highlighted,
                // matching the label's own highlight treatment above.
                index === highlighted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-subtle)]"
              )}
            >
              {option.sub}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

interface TypeaheadInputProps {
  id: string;
  label: string;
  value: string;
  open: boolean;
  highlighted: number;
  placeholder?: string;
  onValueChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function TypeaheadInput({
  id,
  label,
  value,
  open,
  highlighted,
  placeholder,
  onValueChange,
  onOpenChange,
  onKeyDown,
}: TypeaheadInputProps) {
  return (
    <>
      <label
        htmlFor={id}
        className="text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)] uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={open ? optionId(id, highlighted) : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          onValueChange(event.target.value);
          onOpenChange(event.target.value.length > 0);
        }}
        onFocus={() => {
          if (value.length > 0) onOpenChange(true);
        }}
        onKeyDown={onKeyDown}
        className={INPUT_CLASS}
      />
    </>
  );
}

/** refit-mock.html `.typeahead`/`.ta-drop`/`.ta-row` -- single-select
 * input+dropdown (label + mono sub rows). Distinct from `EntityPicker`
 * (multi-select chip picker with internal open state): this variant is
 * fully controlled (`open`/`onOpenChange`) and keyboard-navigable. */
export function TypeaheadField({
  id,
  label,
  value,
  onValueChange,
  options,
  open,
  onOpenChange,
  onPick,
  placeholder,
  className,
}: TypeaheadFieldProps) {
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useResetHighlightOnOpen(open, setHighlighted);
  useOutsideClick(containerRef, () => onOpenChange(false));

  function pick(option: TypeaheadOption) {
    onPick(option);
    onOpenChange(false);
  }

  const onKeyDown = useTypeaheadKeyboard({
    open,
    options,
    highlighted,
    setHighlighted,
    onClose: () => onOpenChange(false),
    onPick: pick,
  });

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-[var(--space-1)]", className)}>
      <TypeaheadInput
        id={id}
        label={label}
        value={value}
        open={open}
        highlighted={highlighted}
        placeholder={placeholder}
        onValueChange={onValueChange}
        onOpenChange={onOpenChange}
        onKeyDown={onKeyDown}
      />
      {open && options.length > 0 && (
        <TypeaheadDropdown id={id} options={options} highlighted={highlighted} onPick={pick} />
      )}
    </div>
  );
}
