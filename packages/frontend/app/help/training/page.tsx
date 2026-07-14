"use client";

import { useMemo, useState } from "react";

import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { TrainingCard } from "@/components/onboarding/training-card";
import { WhatsNewPanel } from "@/components/onboarding/whats-new-panel";
import { t } from "@/lib/onboarding/i18n";
import { filterTraining, groupByCategory, type CategoryGroup } from "@/lib/onboarding/training-content";
import { useWhatsNewUnread } from "@/lib/onboarding/use-whats-new-unread";
import { TRAINING_CATEGORIES } from "../../../../shared/onboarding/content/categories";
import { TRAINING_ENTRIES } from "../../../../shared/onboarding/content/training";
import { WHATS_NEW_ITEMS } from "../../../../shared/onboarding/content/whats-new";

/** AC-012-01: one category's cards, including the post-v1 flag and its own empty state. */
function CategorySection({ group }: { group: CategoryGroup }) {
  return (
    <section className="flex flex-col gap-[var(--space-3)]">
      <h2 className="flex items-center gap-[var(--space-2)] text-[length:var(--text-h4)] text-[var(--color-text-default)]">
        {t(group.category.labelKey)}
        {group.category.availability === "post-v1" ? (
          <span className="rounded-[var(--radius-sm)] bg-[var(--color-raised)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
            {t("onboarding.training.category-post-v1-flag")}
          </span>
        ) : null}
      </h2>
      {group.entries.length === 0 ? (
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {t("onboarding.training.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
          {group.entries.map((entry) => (
            <TrainingCard key={entry.trainingId} entry={entry} />
          ))}
        </div>
      )}
    </section>
  );
}

/** ONB-TASK-012 (E6-S1/E6-S2): searchable training library + What's-new
 * feed. Reachable directly today -- the launcher entry (TASK-013) links
 * here once built. */
export default function TrainingLibraryPage() {
  const [query, setQuery] = useState("");
  const { unread, markSeen } = useWhatsNewUnread();

  const filtered = useMemo(() => filterTraining(TRAINING_ENTRIES, query), [query]);
  const grouped = useMemo(() => groupByCategory(filtered, TRAINING_CATEGORIES), [filtered]);

  return (
    <main className="flex flex-col gap-[var(--space-6)] p-[var(--space-5)]">
      <PageHeaderSlot title="Training library" subtitle="Search videos and written walkthroughs, at your own pace." />

      <label className="flex flex-col gap-[var(--space-1)]" htmlFor="training-search">
        <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {t("onboarding.training.search-label")}
        </span>
        <input
          id="training-search"
          type="search"
          role="searchbox"
          aria-label={t("onboarding.training.search-label")}
          placeholder={t("onboarding.training.search-placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {t("onboarding.training.empty")}
        </p>
      ) : (
        grouped
          .filter((group) => group.entries.length > 0 || group.category.availability !== "shipped")
          .map((group) => <CategorySection key={group.category.categoryId} group={group} />)
      )}

      <section aria-label={t("onboarding.whats-new.heading")}>
        {unread ? (
          <button
            type="button"
            onClick={() => void markSeen()}
            className="mb-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-accent-primary)] hover:underline"
          >
            <span aria-hidden="true" className="mr-[var(--space-1)] inline-block h-[8px] w-[8px] rounded-full bg-[var(--color-accent-primary)]" />
            Mark What&apos;s new as read
          </button>
        ) : null}
        <WhatsNewPanel items={WHATS_NEW_ITEMS} />
      </section>
    </main>
  );
}
