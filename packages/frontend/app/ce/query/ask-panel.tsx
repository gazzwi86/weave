import { AskPanelTemplate } from "@/components/templates/AskPanelTemplate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { EXAMPLE_QUESTIONS } from "./example-questions";
import { ResultFrame } from "./result-frame";
import { VersionSelect } from "./version-select";
import type { AskLifecycleState } from "./use-ask-lifecycle";

/** CE-V1-TASK-032 AC-1: the submitting state's visible-progress indicator --
 * always rendered the instant `ask()` fires, never a silent gap. */
function SubmittingState() {
  return (
    <p role="status" data-testid="ask-submitting" className="text-[var(--color-text-muted)]">
      Asking…
    </p>
  );
}

/** CE-V1-TASK-032 AC-2/AC-3/AC-4: the three failure states share one shape
 * (message + example questions) but stay visually/textually distinct via
 * `data-testid` and heading text -- split out to keep `AskPanel` under the
 * per-function line budget (Law E). */
function FailureState({
  testId,
  heading,
  message,
  onRetry,
}: {
  testId: string;
  heading: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <>
      <p role="alert" data-testid={testId} className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {heading}
      </p>
      <p className="text-[var(--color-text-muted)]">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      )}
      <div>
        <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">Try asking:</p>
        <ul className="list-inside list-disc text-[var(--color-text-muted)]">
          {EXAMPLE_QUESTIONS.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>
    </>
  );
}

function askFunction(nl: AskLifecycleState): () => void {
  return () => {
    nl.ask().catch(() => undefined);
  };
}

/** Renders the one lifecycle-state branch that's active -- split out of
 * `AskPanel` to keep it under the complexity budget (Law E). */
function LifecycleBody({ nl, onCopyToEditor }: { nl: AskLifecycleState; onCopyToEditor: (sparql: string) => void }) {
  switch (nl.status) {
    case "submitting":
      return <SubmittingState />;
    case "provider-missing":
      return (
        <FailureState
          testId="ask-provider-missing"
          heading="The AI provider is unavailable"
          message={nl.errorMessage ?? "Try again shortly, or use the SPARQL editor below."}
        />
      );
    case "timeout":
      return (
        <FailureState testId="ask-timeout" heading="That took too long" message="The question timed out." onRetry={nl.retry} />
      );
    case "error":
      return (
        <FailureState testId="ask-error" heading="Couldn't answer that" message={nl.errorMessage ?? "Something went wrong."} />
      );
    case "success":
      return nl.result ? <ResultFrame result={nl.result} onCopyToEditor={onCopyToEditor} /> : null;
    default:
      return null;
  }
}

/** CE-V1-TASK-032 AC-1..AC-8: the ask bar + its explicit lifecycle states
 * and, on success, the shared `ResultFrame`. Replaces the M1
 * `NlQuestionCard`'s single-branch (dead-air-prone) rendering. Data-fetch
 * lives in `useAskLifecycle`; this component binds it onto the dumb
 * `AskPanelTemplate` (app-layer boundary, Law 20). */
export function AskPanel({ nl, onCopyToEditor }: { nl: AskLifecycleState; onCopyToEditor: (sparql: string) => void }) {
  const isFailure = nl.status === "provider-missing" || nl.status === "timeout" || nl.status === "error";

  return (
    <Card>
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Ask a question
      </p>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <VersionSelect value={nl.version} onChange={nl.setVersion} />
        <AskPanelTemplate
          question={nl.question}
          loading={nl.status === "submitting"}
          onQuestionChange={nl.setQuestion}
          onSubmit={askFunction(nl)}
          showGlass={isFailure}
        >
          <LifecycleBody nl={nl} onCopyToEditor={onCopyToEditor} />
        </AskPanelTemplate>
      </CardContent>
    </Card>
  );
}
