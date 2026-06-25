import { useState } from 'react';
import type { NodeKind } from '../types';
import FormField from './FormField';

interface Props {
  kinds: NodeKind[];
  onSubmit: (input: { label: string; kind: string; comment?: string }) => void;
  onClose: () => void;
  pending?: boolean;
}

/** Form to create a new node (label, kind, comment). */
export default function AddNodeForm({ kinds, onSubmit, onClose, pending }: Props) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState(kinds[0]?.key ?? 'Concept');
  const [comment, setComment] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    onSubmit({ label: label.trim(), kind, comment: comment.trim() || undefined });
  }

  return (
    <form className="popover" onSubmit={submit} aria-label="Add node">
      <h4>Add node</h4>
      <FormField id="node-label" label="Label">
        <input
          id="node-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
      </FormField>
      <FormField id="node-kind" label="Kind">
        <select id="node-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map((k) => (
            <option key={k.key} value={k.key}>
              {k.key}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="node-comment" label="Comment">
        <textarea
          id="node-comment"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormField>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending || !label.trim()}>
          Add
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
