import type { ReactNode } from "react";

import { AskBar } from "@/components/molecules/AskBar";
import { GlassPanel } from "@/components/organisms/GlassPanel";

export interface AskPanelTemplateProps {
  question: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onSubmit: () => void;
  /** The version selector, error/timeout/provider-missing state, or result
   * frame -- data-bound by the caller, never fetched here. */
  children: ReactNode;
  /** True while a failure state's message/examples are shown -- switches
   * the surrounding surface to the glass-elevated overlay treatment
   * (`components.md` "Glass vs flat"). */
  showGlass?: boolean;
}

/** CE-V1-TASK-032: the ask lifecycle's page shell -- `AskBar` above,
 * caller-supplied lifecycle-state content below, optionally wrapped in
 * `GlassPanel` for the failure states. Data-only props, no fetch/state --
 * satisfies the app-layer boundary (app/** may only import templates). */
export function AskPanelTemplate({
  question,
  loading,
  onQuestionChange,
  onSubmit,
  children,
  showGlass,
}: AskPanelTemplateProps) {
  const body = <div className="flex flex-col gap-[var(--space-3)]">{children}</div>;

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <AskBar value={question} loading={loading} onChange={onQuestionChange} onSubmit={onSubmit} />
      {showGlass ? <GlassPanel>{body}</GlassPanel> : body}
    </div>
  );
}
