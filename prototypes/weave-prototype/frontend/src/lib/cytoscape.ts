// Map the Weave graph model into Cytoscape elements + a colourful stylesheet.

import type { ElementDefinition, StylesheetStyle } from 'cytoscape';
import type { Graph, NodeKind } from '../types';
import { colorForNode } from './colors';

export interface CyData {
  nodes: ElementDefinition[];
  edges: ElementDefinition[];
}

/** Convert a graph into Cytoscape node + edge element definitions. */
export function graphToElements(graph: Graph, kinds?: NodeKind[]): CyData {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const nodes: ElementDefinition[] = graph.nodes.map((node) => ({
    group: 'nodes',
    data: {
      id: node.id,
      label: node.label,
      kind: node.kind,
      color: colorForNode(node, kinds),
    },
  }));

  // Only keep edges whose endpoints exist, so Cytoscape never throws.
  const edges: ElementDefinition[] = graph.edges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({
      group: 'edges',
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: edge.type,
      },
    }));

  return { nodes, edges };
}

export function flattenElements(data: CyData): ElementDefinition[] {
  return [...data.nodes, ...data.edges];
}

export const cytoscapeStylesheet: StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(color)',
      label: 'data(label)',
      color: '#0f172a',
      'font-size': 11,
      'font-weight': 600,
      'text-valign': 'bottom',
      'text-margin-y': 4,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      width: 34,
      height: 34,
      'border-width': 2,
      'border-color': '#ffffff',
      'transition-property': 'opacity, border-color, border-width',
      'transition-duration': 150,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'line-color': '#cbd5e1',
      'target-arrow-color': '#cbd5e1',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': 9,
      color: '#64748b',
      'text-opacity': 0,
      'text-rotation': 'autorotate',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'transition-property': 'opacity, line-color, text-opacity',
      'transition-duration': 150,
    },
  },
  {
    selector: 'node.selected',
    style: { 'border-color': '#0f172a', 'border-width': 3 },
  },
  {
    selector: 'edge.selected',
    style: { 'line-color': '#0f172a', 'target-arrow-color': '#0f172a', width: 3 },
  },
  {
    selector: '.dimmed',
    style: { opacity: 0.18 },
  },
  {
    selector: '.hidden',
    style: { display: 'none' },
  },
];

export const fcoseLayout = {
  name: 'fcose',
  quality: 'default',
  animate: true,
  animationDuration: 600,
  randomize: true,
  nodeSeparation: 90,
  idealEdgeLength: 110,
  nodeRepulsion: 6500,
} as const;
