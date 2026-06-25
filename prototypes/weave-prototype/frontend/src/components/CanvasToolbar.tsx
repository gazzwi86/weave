import { useState } from 'react';
import type { Graph, NodeKind, RelationshipType } from '../types';
import { useCreateEdge, useCreateNode, useImportSchema } from '../hooks/queries';
import AddNodeForm from './AddNodeForm';
import AddEdgeForm from './AddEdgeForm';
import ImportSchemaForm from './ImportSchemaForm';

interface Props {
  projectId: string;
  graph: Graph;
  kinds: NodeKind[];
  types: RelationshipType[];
  onResetLayout?: () => void;
}

type OpenForm = 'node' | 'edge' | 'schema' | null;

/** Toolbar above the canvas hosting the add-node / add-edge / import popovers. */
export default function CanvasToolbar({ projectId, graph, kinds, types, onResetLayout }: Props) {
  const [open, setOpen] = useState<OpenForm>(null);
  const createNode = useCreateNode(projectId);
  const createEdge = useCreateEdge(projectId);
  const importSchema = useImportSchema(projectId);
  const concepts = graph.nodes.filter((n) => n.kind === 'Concept');

  return (
    <div className="canvas-toolbar">
      <div className="toolbar-group">
        <button className="btn" onClick={() => setOpen(open === 'node' ? null : 'node')}>
          ＋ Add node
        </button>
        {open === 'node' && (
          <AddNodeForm
            kinds={kinds}
            pending={createNode.isPending}
            onClose={() => setOpen(null)}
            onSubmit={(input) =>
              createNode.mutate(input, { onSuccess: () => setOpen(null) })
            }
          />
        )}
      </div>

      <div className="toolbar-group">
        <button
          className="btn"
          disabled={graph.nodes.length < 2}
          onClick={() => setOpen(open === 'edge' ? null : 'edge')}
        >
          ＋ Add relationship
        </button>
        {open === 'edge' && (
          <AddEdgeForm
            nodes={graph.nodes}
            types={types}
            pending={createEdge.isPending}
            onClose={() => setOpen(null)}
            onSubmit={(input) =>
              createEdge.mutate(input, { onSuccess: () => setOpen(null) })
            }
          />
        )}
      </div>

      <div className="toolbar-group">
        <button className="btn" onClick={() => setOpen(open === 'schema' ? null : 'schema')}>
          ⬆ Import schema
        </button>
        {open === 'schema' && (
          <ImportSchemaForm
            concepts={concepts}
            pending={importSchema.isPending}
            onClose={() => setOpen(null)}
            onSubmit={(input) =>
              importSchema.mutate(input, { onSuccess: () => setOpen(null) })
            }
          />
        )}
      </div>

      <span className="muted" style={{ fontSize: 12 }}>
        {graph.nodes.length} nodes · {graph.edges.length} edges
      </span>
      {onResetLayout && (
        <button
          className="btn btn-sm"
          title="Reset saved node positions and rerun auto-layout"
          onClick={onResetLayout}
        >
          Reset layout
        </button>
      )}
    </div>
  );
}
