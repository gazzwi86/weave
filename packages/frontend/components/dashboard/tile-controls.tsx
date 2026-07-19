import { Icon, type IconName } from "@/components/ui/icon";

/** Square icon-button chrome lifted from AppHeader's SidebarExpandButton --
 * the repo's one established icon-button pattern (token-based, aria-label +
 * native `title` tooltip since there's no shared Tooltip component). */
function TileIconButton({
  label,
  icon,
  iconClassName,
  onClick,
}: {
  label: string;
  icon: IconName;
  iconClassName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      <Icon name={icon} size={14} className={iconClassName} />
    </button>
  );
}

/** ponytail: no pin/pin-off glyph exists in the mock's icon sprite
 * (refit-mock.html's `<defs>`) and icon.tsx's own convention is to lift
 * paths verbatim from it rather than invent new ones -- Pin/Unpin stay
 * text buttons (still real <button>s, token-styled) until a pin glyph is
 * added to the mock. Publish reuses the existing `upload` icon instead. */
function TileTextButton({ label, children, onClick }: { label: string; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-[var(--radius-base)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-medium)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      {children}
    </button>
  );
}

export interface TileControlsProps {
  title: string;
  onPin?: () => void;
  onUnpin?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPublish?: () => void;
  /** True while the widget is agent-suggested and not yet pinned (backend
   * `WidgetOut.suggested`) -- Pin shows; once pinned (`suggested=false`)
   * Unpin shows instead. Never both at once. */
  showPin: boolean;
}

/** Extracted from `WidgetTile` (both for its own complexity budget and to
 * keep widget-tile.tsx under the 300-line file cap). */
export function TileControls({ title, onPin, onUnpin, onMoveUp, onMoveDown, onPublish, showPin }: TileControlsProps) {
  return (
    <div className="flex shrink-0 items-center gap-[var(--space-1)]">
      {onMoveUp && (
        <TileIconButton label={`Move ${title} up`} icon="chev-d" iconClassName="rotate-180" onClick={onMoveUp} />
      )}
      {onMoveDown && <TileIconButton label={`Move ${title} down`} icon="chev-d" onClick={onMoveDown} />}
      {onPin && showPin && <TileTextButton label={`Pin ${title}`} onClick={onPin}>Pin</TileTextButton>}
      {onUnpin && !showPin && <TileTextButton label={`Unpin ${title}`} onClick={onUnpin}>Unpin</TileTextButton>}
      {onPublish && (
        <TileIconButton label={`Publish ${title} to library`} icon="upload" onClick={onPublish} />
      )}
    </div>
  );
}
