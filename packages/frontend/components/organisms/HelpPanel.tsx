import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** refit-mock.html's `.hc-icon` tone variants (`v-purple`/`v-green`) --
 * reuses existing dual-theme tokens (BellPanel's RowIcon pattern) rather
 * than inventing new tint tokens: `--color-kind-businessdomain` is the
 * documented brand-purple family member (color.md), `--color-success` is
 * the mock's green. `undefined` renders the default accent tone. */
export type HelpCardTone = "accent" | "purple" | "green";

const TONE_ICON_CLASS: Record<HelpCardTone, string> = {
  accent: "text-[var(--color-accent-primary)]",
  purple: "text-[var(--color-kind-businessdomain)]",
  green: "text-[var(--color-success)]",
};

export interface HelpCardItem {
  icon: IconName;
  tone?: HelpCardTone;
  title: string;
  subtitle: string;
  href?: string;
  onClick?: () => void;
}

export interface HelpKeyboardRow {
  label: string;
  keys: string;
}

export interface HelpPanelProps {
  cards: HelpCardItem[];
  /** Static, real app shortcuts (⌘K palette, Esc close, ⌘\ sidebar toggle) --
   * refit-mock.html's `.kbd-row` list; defaults to those three since they're
   * true of every route, not mock placeholder copy. */
  keyboardRows?: HelpKeyboardRow[];
  /** Smart Dialog.Close element from the wrapper -- HelpPanel only places it
   * in the header (icon-only X), same slot pattern as BellPanel/UserMenu. */
  closeSlot?: ReactNode;
  /** Pre-existing functional help content (contextual links, tour deep-
   * links, show-hints/training/change-path entries, checklist restore) --
   * the wrapper still owns all of it; HelpPanel only gives it a section
   * slot between "Get going" and "Keyboard". */
  children?: ReactNode;
  className?: string;
}

const DEFAULT_KEYBOARD_ROWS: HelpKeyboardRow[] = [
  { label: "Command palette", keys: "⌘K" },
  { label: "Close panel / dialog", keys: "Esc" },
  { label: "Toggle sidebar", keys: "⌘\\" },
];

/** refit-mock.html's `.flyout-head`: gradient `.fh-icon` sparkles chip +
 * title + the wrapper's close-button slot (icon-only X, never text). */
function PanelHeader({ closeSlot }: { closeSlot?: ReactNode }) {
  return (
    <div className="flex items-center gap-[var(--space-2)] border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
      <span className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] bg-[image:var(--gradient-accent)] text-[var(--color-bg)]">
        <Icon name="sparkles" size={15} />
      </span>
      <p className="flex-1 text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Help &amp; learning
      </p>
      {closeSlot}
    </div>
  );
}

/** refit-mock.html's `.help-card`: tinted icon chip + title/subtitle, hover
 * translateX -- an `<a>` when `href` is given, else a button so the wrapper
 * can drive it (e.g. starting the guided tour). */
function HelpCard({ card }: { card: HelpCardItem }) {
  const cardClass = cn(
    "flex items-center gap-[var(--space-2)] rounded-[var(--radius-lg)] border border-[var(--color-border)]",
    "bg-[var(--color-raised)] p-[var(--space-2)] text-left transition-[border-color,transform]",
    "duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:translate-x-0.5 hover:border-[var(--color-accent-primary)]"
  );
  const content = (
    <>
      <span
        className={cn(
          "flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)]",
          "border border-[var(--color-border-strong)] bg-[var(--color-overlay)]",
          TONE_ICON_CLASS[card.tone ?? "accent"]
        )}
      >
        <Icon name={card.icon} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-label)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {card.title}
        </span>
        <span className="block text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {card.subtitle}
        </span>
      </span>
    </>
  );

  if (card.href) {
    return (
      <a href={card.href} className={cardClass}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={card.onClick} className={cn(cardClass, "w-full")}>
      {content}
    </button>
  );
}

function GetGoingSection({ cards }: { cards: HelpCardItem[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
      <p className="mb-[var(--space-2)] text-[length:var(--text-overline)] uppercase tracking-[.06em] text-[var(--color-text-subtle)]">
        Get going
      </p>
      <div className="flex flex-col gap-[var(--space-2)]">
        {cards.map((card) => (
          <HelpCard key={card.title} card={card} />
        ))}
      </div>
    </div>
  );
}

function KeyboardSection({ rows }: { rows: HelpKeyboardRow[] }) {
  return (
    <div className="px-[var(--space-4)] py-[var(--space-3)]">
      <p className="mb-[var(--space-2)] text-[length:var(--text-overline)] uppercase tracking-[.06em] text-[var(--color-text-subtle)]">
        Keyboard
      </p>
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]"
        >
          <span>{row.label}</span>
          <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] px-[var(--space-1)] font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
            {row.keys}
          </kbd>
        </div>
      ))}
    </div>
  );
}

/** Help flyout (refit-mock.html's `#help-backdrop` .flyout): gradient
 * sparkles header + icon-only close, "Get going" tour/docs/support cards,
 * a slot for the pre-existing functional help content, and the real
 * keyboard shortcuts -- extracted from `components/shell/help-launcher.tsx`,
 * which still owns the Radix Dialog, route gating, and every fetch call. */
export function HelpPanel({
  cards,
  keyboardRows = DEFAULT_KEYBOARD_ROWS,
  closeSlot,
  children,
  className,
}: HelpPanelProps) {
  return (
    <div
      role="region"
      aria-label="Help & learning"
      className={cn(
        "flex max-h-[calc(100vh-var(--space-10))] w-[var(--size-flyout)] max-w-full flex-col overflow-hidden rounded-[var(--radius-lg)]",
        "border border-[var(--color-border-strong)] bg-[var(--color-overlay)]/[.72] shadow-[var(--shadow-overlay)] backdrop-blur-md",
        "animate-[flyDown_var(--duration-base)_var(--ease-standard)]",
        className
      )}
    >
      <PanelHeader closeSlot={closeSlot} />
      <div className="flex-1 overflow-y-auto">
        <GetGoingSection cards={cards} />
        {children ? (
          <div className="flex flex-col gap-[var(--space-4)] border-b border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-3)]">
            {children}
          </div>
        ) : null}
        <KeyboardSection rows={keyboardRows} />
      </div>
    </div>
  );
}
