import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useApplyOperations, useLlmPropose } from '../hooks/queries';
import { localName } from '../lib/graph';
import type { LLMProposeResult, LlmOperation } from '../types';

interface Props {
  projectId: string;
}

const OFFLINE_MSG =
  'The AI assistant is offline. Set ANTHROPIC_API_KEY on the backend to enable natural-language edits.';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Human-readable one-liner for a proposed operation. */
function describeOp(op: LlmOperation): string {
  switch (op.op) {
    case 'add_node':
      return `Add ${str(op.kind) || 'node'} “${str(op.label)}”`;
    case 'update_node':
      return `Update “${str(op.label) || localName(str(op.id))}”`;
    case 'add_edge':
      return `Link ${localName(str(op.source))} —${str(op.type)}→ ${localName(str(op.target))}`;
    case 'delete_node':
      return `Delete ${localName(str(op.id))}`;
    case 'delete_edge':
      return `Unlink ${localName(str(op.source))} —${str(op.type)}→ ${localName(str(op.target))}`;
    default:
      return op.op;
  }
}

/**
 * Natural-language change bar with a staged flow: describe → review the
 * proposed changes → approve (apply) or discard. Nothing touches the graph
 * until the user approves.
 */
export default function LlmBar({ projectId }: Props) {
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<LLMProposeResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const propose = useLlmPropose(projectId);
  const apply = useApplyOperations(projectId);

  function onError(err: unknown) {
    if (err instanceof ApiError && err.status === 503) setWarning(OFFLINE_MSG);
    else setWarning(err instanceof Error ? err.message : 'Something went wrong.');
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    setWarning(null);
    setProposal(null);
    propose.mutate(text, { onSuccess: setProposal, onError });
  }

  function approve() {
    if (!proposal) return;
    apply.mutate(proposal.operations, {
      onSuccess: () => {
        setProposal(null);
        setPrompt('');
      },
      onError,
    });
  }

  function discard() {
    setProposal(null);
    setWarning(null);
  }

  return (
    <div>
      <form className="llm-bar" onSubmit={submit}>
        <input
          aria-label="Describe a change"
          placeholder="Describe a change…  e.g. add a System called Billing connected to the Orders service"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={propose.isPending || !prompt.trim()}
        >
          {propose.isPending ? 'Thinking…' : 'Propose'}
        </button>
      </form>

      {warning && <div className="llm-result warn">{warning}</div>}

      {proposal && (
        <div className="llm-result">
          <strong>{proposal.message}</strong>
          {proposal.operations.length > 0 ? (
            <>
              <ul>
                {proposal.operations.map((op, i) => (
                  <li key={i}>{describeOp(op)}</li>
                ))}
              </ul>
              <div className="row">
                <button className="btn btn-primary" onClick={approve} disabled={apply.isPending}>
                  {apply.isPending
                    ? 'Applying…'
                    : `Apply ${proposal.operations.length} change${
                        proposal.operations.length === 1 ? '' : 's'
                      }`}
                </button>
                <button className="btn" onClick={discard} disabled={apply.isPending}>
                  Discard
                </button>
              </div>
            </>
          ) : (
            <p className="muted">No changes proposed.</p>
          )}
        </div>
      )}
    </div>
  );
}
