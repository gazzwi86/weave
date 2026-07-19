/** Current calendar month as ISO `date_from`/`date_to` bounds, UTC -- shared
 * by `use-event-counts.ts` and `use-kind-counts.ts` (both dashboard cards are
 * scoped "this month"). Must only be called from inside a mount effect, same
 * rule as `use-compliance.ts`'s `currentAndPreviousMonth` (this codebase was
 * bitten twice by `new Date()` during render causing SSR hydration
 * divergence).
 */
export function currentMonthRange(): { date_from: string; date_to: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { date_from: start.toISOString(), date_to: now.toISOString() };
}
