import { describe, expect, it } from 'vitest';
import { toObjectRows } from './objects';
import type { Graph } from '../types';

const graph: Graph = {
  nodes: [
    { id: 'n/sys', label: 'Storefront', kind: 'System', color: '#000', domain: 'n/dom' },
    { id: 'n/dom', label: 'Commerce', kind: 'BusinessDomain', color: '#111' },
    { id: 'n/svc', label: 'Order API', kind: 'Service', color: '#222' },
  ] as Graph['nodes'],
  edges: [
    { id: 'e1', source: 'n/sys', target: 'n/svc', type: 'dependsOn', label: 'depends on' },
    { id: 'e2', source: 'n/svc', target: 'n/sys', type: 'partOf', label: 'part of' },
  ] as Graph['edges'],
};

describe('toObjectRows', () => {
  it('counts incident edges as connections', () => {
    const rows = toObjectRows(graph);
    const sys = rows.find((r) => r.id === 'n/sys')!;
    expect(sys.connections).toBe(2);
    const dom = rows.find((r) => r.id === 'n/dom')!;
    expect(dom.connections).toBe(0);
  });

  it('resolves the domain id to its label', () => {
    const sys = toObjectRows(graph).find((r) => r.id === 'n/sys')!;
    expect(sys.domain).toBe('Commerce');
  });

  it('leaves domain blank when unset', () => {
    const svc = toObjectRows(graph).find((r) => r.id === 'n/svc')!;
    expect(svc.domain).toBe('');
  });
});
