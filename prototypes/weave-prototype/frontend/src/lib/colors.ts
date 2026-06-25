// Canonical node-kind colour palette. The backend also serves these via
// /api/node-kinds; this is the local fallback / default mapping.

import type { GraphNode, NodeKind } from '../types';

export const KIND_COLORS: Record<string, string> = {
  BusinessDomain: '#7c3aed',
  BusinessCapability: '#db2777',
  System: '#2563eb',
  Service: '#0891b2',
  DataAsset: '#16a34a',
  Field: '#65a30d',
  Concept: '#ea580c',
  Class: '#d97706',
};

const FALLBACK_COLOR = '#64748b';

/** Resolve the display colour for a kind, optionally using server kinds. */
export function colorForKind(kind: string, kinds?: NodeKind[]): string {
  if (kinds) {
    const match = kinds.find((k) => k.key === kind);
    if (match?.color) return match.color;
  }
  return KIND_COLORS[kind] ?? FALLBACK_COLOR;
}

/** Prefer an explicit node colour, else fall back to its kind colour. */
export function colorForNode(node: GraphNode, kinds?: NodeKind[]): string {
  if (node.color) return node.color;
  return colorForKind(node.kind, kinds);
}
