import { describe, expect, it } from 'vitest';
import { colorForKind, colorForNode } from './colors';
import type { GraphNode, NodeKind } from '../types';

const baseNode: GraphNode = {
  id: 'n1',
  label: 'Orders',
  kind: 'System',
  color: '',
};

describe('colorForKind', () => {
  it('maps known kinds to their palette colour', () => {
    expect(colorForKind('BusinessDomain')).toBe('#7c3aed');
    expect(colorForKind('System')).toBe('#2563eb');
  });

  it('falls back to a neutral colour for unknown kinds', () => {
    expect(colorForKind('Mystery')).toBe('#64748b');
  });

  it('prefers a server-provided kind colour when given', () => {
    const kinds: NodeKind[] = [{ key: 'System', iri: 'x', color: '#000000' }];
    expect(colorForKind('System', kinds)).toBe('#000000');
  });
});

describe('colorForNode', () => {
  it('uses an explicit node colour when present', () => {
    expect(colorForNode({ ...baseNode, color: '#abcabc' })).toBe('#abcabc');
  });

  it('falls back to the kind colour when no node colour is set', () => {
    expect(colorForNode(baseNode)).toBe('#2563eb');
  });
});
