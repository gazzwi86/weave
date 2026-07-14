import { t } from "../../lib/onboarding/i18n";
import { EmptyState } from "../molecules/EmptyState";
import type { WhatsNewItem } from "../../../shared/onboarding/content/schema";

export interface WhatsNewPanelProps {
  items: WhatsNewItem[];
  /** Default 5, tunable (brief AC-012-04). */
  maxItems?: number;
}

/** AC-012-04/05: last N release items (version, date, headline, description);
 * empty/unavailable feed shows the panel's empty state, never an error. */
export function WhatsNewPanel({ items, maxItems = 5 }: WhatsNewPanelProps) {
  if (items.length === 0) {
    return <EmptyState message={t("onboarding.whats-new.empty")} />;
  }

  const visible = [...items]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, maxItems);

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <h2 className="text-[length:var(--text-body)] text-[var(--color-text-default)]">
        {t("onboarding.whats-new.heading")}
      </h2>
      <ul className="flex flex-col gap-[var(--space-3)]">
        {visible.map((item) => (
          <li
            key={item.itemId}
            data-testid="whats-new-item"
            className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-base)] border border-[var(--color-border)] p-[var(--space-3)]"
          >
            <div className="flex items-center gap-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
              <span>{item.version}</span>
              <span>{item.publishedAt}</span>
            </div>
            <h3 className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{t(item.titleKey)}</h3>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{t(item.bodyKey)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
