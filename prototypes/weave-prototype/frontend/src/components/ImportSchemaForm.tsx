import { useState } from 'react';
import type { GraphNode, SchemaFormat, SchemaImport } from '../types';

interface Props {
  concepts: GraphNode[];
  onSubmit: (input: SchemaImport) => void;
  onClose: () => void;
  pending?: boolean;
}

const PLACEHOLDER =
  'Paste CSV (header row + a sample row), e.g.\nid,email,created_at\n42,a@b.com,2024-01-02';

/** Import a CSV or JSON Schema as a DataAsset + Field nodes. */
export default function ImportSchemaForm({ concepts, onSubmit, onClose, pending }: Props) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<SchemaFormat>('csv');
  const [content, setContent] = useState('');
  const [concept, setConcept] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    onSubmit({
      name: name.trim(),
      format,
      content,
      concept: concept || null,
    });
  }

  return (
    <form className="popover" onSubmit={submit} aria-label="Import schema">
      <h4>Import schema</h4>
      <div className="field">
        <label htmlFor="schema-name">Data asset name</label>
        <input id="schema-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="schema-format">Format</label>
        <select
          id="schema-format"
          value={format}
          onChange={(e) => setFormat(e.target.value as SchemaFormat)}
        >
          <option value="csv">CSV</option>
          <option value="json_schema">JSON Schema</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="schema-content">Schema</label>
        <textarea
          id="schema-content"
          rows={5}
          value={content}
          placeholder={PLACEHOLDER}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="schema-concept">Describes concept (optional)</label>
        <select
          id="schema-concept"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        >
          <option value="">— none —</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || !name.trim() || !content.trim()}
        >
          Import
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
