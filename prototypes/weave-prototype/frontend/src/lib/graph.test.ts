import { describe, expect, it } from 'vitest';
import { labelOf, localName } from './graph';
import type { Graph } from '../types';

const graph: Graph = {
  nodes: [
    { id: 'https://weave.dev/resource/order-api', label: 'Order API', kind: 'Service', color: '#000' },
  ],
  edges: [],
};

describe('localName', () => {
  it('takes the part after the last / or #', () => {
    expect(localName('https://weave.dev/resource/order-api')).toBe('order-api');
    expect(localName('http://www.w3.org/2004/02/skos/core#Concept')).toBe('Concept');
  });
  it('falls back to the input when there is no separator', () => {
    expect(localName('plain')).toBe('plain');
  });
});

describe('labelOf', () => {
  it('returns a known node label', () => {
    expect(labelOf(graph, 'https://weave.dev/resource/order-api')).toBe('Order API');
  });
  it('falls back to the local name for an unknown id', () => {
    expect(labelOf(graph, 'https://weave.dev/resource/missing-thing')).toBe('missing-thing');
  });
});
