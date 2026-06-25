import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './api';

function mockFetch(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  const res = new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(res);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('GETs the graph with the project_id query param', async () => {
    const spy = mockFetch({ nodes: [], edges: [] });
    const graph = await api.getGraph('demo');

    expect(graph).toEqual({ nodes: [], edges: [] });
    const url = new URL(spy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/graph');
    expect(url.searchParams.get('project_id')).toBe('demo');
  });

  it('POSTs a new node with a JSON body and returns its id', async () => {
    const spy = mockFetch({ id: 'node-1' });
    const result = await api.createNode('demo', { label: 'Orders', kind: 'System' });

    expect(result).toEqual({ id: 'node-1' });
    const [, options] = spy.mock.calls[0];
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toMatchObject({
      label: 'Orders',
      kind: 'System',
    });
  });

  it('POSTs a schema import to the project', async () => {
    const spy = mockFetch({ nodes: [], edges: [] });
    await api.importSchema('p1', { name: 'Orders', format: 'csv', content: 'id\n1\n' });

    const [url, options] = spy.mock.calls[0];
    expect(new URL(url as string).pathname).toBe('/api/schema/import');
    expect(new URL(url as string).searchParams.get('project_id')).toBe('p1');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toMatchObject({ name: 'Orders', format: 'csv' });
  });

  it('GETs the schema rules', async () => {
    const spy = mockFetch([{ id: 'DescribesShape', relationship: 'describes' }]);
    const rules = await api.getRules();

    expect(rules).toHaveLength(1);
    expect(new URL(spy.mock.calls[0][0] as string).pathname).toBe('/api/rules');
  });

  it('throws an ApiError carrying the status on a failed request', async () => {
    mockFetch({ detail: 'AI assistant offline' }, { status: 503 });
    await expect(api.llmMutate('demo', 'hi', true)).rejects.toMatchObject({
      name: 'ApiError',
      status: 503,
    });
    expect(ApiError).toBeDefined();
  });
});
