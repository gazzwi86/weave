import { useState } from 'react';
import type { GraphNode, RelationshipType } from '../types';
import FormField from './FormField';

interface Props {
  nodes: GraphNode[];
  types: RelationshipType[];
  onSubmit: (input: {
    source: string;
    target: string;
    type: string;
    comment?: string;
  }) => void;
  onClose: () => void;
  pending?: boolean;
}

/** Form to create a relationship between two existing nodes. */
export default function AddEdgeForm({
  nodes,
  types,
  onSubmit,
  onClose,
  pending,
}: Props) {
  const [source, setSource] = useState(nodes[0]?.id ?? '');
  const [target, setTarget] = useState(nodes[1]?.id ?? nodes[0]?.id ?? '');
  const [type, setType] = useState(types[0]?.key ?? '');
  const [comment, setComment] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!source || !target || !type || source === target) return;
    onSubmit({ source, target, type, comment: comment.trim() || undefined });
  }

  return (
    <form className="popover" onSubmit={submit} aria-label="Add relationship">
      <h4>Add relationship</h4>
      <FormField id="edge-source" label="Source">
        <select id="edge-source" value={source} onChange={(e) => setSource(e.target.value)}>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="edge-type" label="Type">
        <select id="edge-type" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="edge-target" label="Target">
        <select id="edge-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="edge-comment" label="Comment">
        <textarea
          id="edge-comment"
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </FormField>
      {source === target && <p className="error-text">Pick two different nodes.</p>}
      <div className="row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !source || !target || source === target || !type}
        >
          Add
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
