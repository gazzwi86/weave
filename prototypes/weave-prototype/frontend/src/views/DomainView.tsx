import { useEffect, useMemo } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraph, useNodeKinds } from '../hooks/queries';
import { graphToFlow } from '../lib/reactflow';

interface Props {
  projectId: string;
}

/** Domain view: React Flow layout of all nodes, no connectors displayed. */
export default function DomainView({ projectId }: Props) {
  const graphQuery = useGraph(projectId);
  const { data: kinds = [] } = useNodeKinds();

  const flow = useMemo(
    () => graphToFlow(graphQuery.data ?? { nodes: [], edges: [] }, kinds),
    [graphQuery.data, kinds],
  );

  // No edges: the domain view is a positional layout, not a relationship diagram.
  return <DomainCanvas nodes={flow.nodes} edges={[]} loading={graphQuery.isLoading} />;
}

function DomainCanvas({
  nodes: initialNodes,
  edges: initialEdges,
  loading,
}: {
  nodes: ReturnType<typeof graphToFlow>['nodes'];
  edges: ReturnType<typeof graphToFlow>['edges'];
  loading: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // React Flow seeds its internal state only on mount; re-sync when the graph
  // changes (add/edit/LLM) so the Model canvas never shows stale data.
  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  if (loading) return <LoadingSpinner message="Loading domain view…" />;

  return (
    <div className="view">
      <div className="rf-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
