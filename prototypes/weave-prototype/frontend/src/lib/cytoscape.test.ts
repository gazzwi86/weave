import { describe, expect, it } from 'vitest';
import { graphToElements } from './cytoscape';
import type { Graph } from '../types';

const graph: Graph = {
  nodes: [
    { id: 'a', label: 'A', kind: 'System', color: '' },
    { id: 'b', label: 'B', kind: 'Service', color: '#123456' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', type: 'uses', label: 'uses' },
    // Dangling edge: target does not exist and must be dropped.
    { id: 'e2', source: 'a', target: 'ghost', type: 'uses', label: 'uses' },
  ],
};

describe('graphToElements', () => {
  it('maps every node and colours by kind / explicit colour', () => {
    const { nodes } = graphToElements(graph);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].data.color).toBe('#2563eb'); // System kind colour
    expect(nodes[1].data.color).toBe('#123456'); // explicit node colour
  });

  it('drops edges whose endpoints are missing', () => {
    const { edges } = graphToElements(graph);
    expect(edges).toHaveLength(1);
    expect(edges[0].data.id).toBe('e1');
    expect(edges[0].data.label).toBe('uses');
  });
});
