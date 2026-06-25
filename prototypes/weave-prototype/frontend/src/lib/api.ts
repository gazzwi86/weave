// Typed client for the Weave backend. All server state flows through here.

import type {
  EdgeInput,
  EdgeRef,
  GlossaryTerm,
  Graph,
  HistoryEvent,
  InventoryItem,
  LLMMutateResult,
  LLMProposeResult,
  LLMSettings,
  LLMSettingsUpdate,
  LlmOperation,
  NodeInput,
  OllamaModel,
  OperationsApplyResult,
  NodeKind,
  Project,
  ProjectCreate,
  ProjectUpdate,
  RelationshipType,
  Rule,
  RuleInput,
  SchemaImport,
  Snapshot,
  SnapshotInput,
  SparqlResult,
} from '../types';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // Append (not replace) onto the base so a configured path prefix survives,
  // e.g. VITE_API_BASE_URL=https://host/weave -> https://host/weave/api/...
  const base = API_BASE_URL.replace(/\/+$/, '');
  const url = new URL(`${base}/api${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const res = await fetch(buildUrl(path, query), {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const message = await readError(res);
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === 'string') return data.detail;
    if (data.detail) return JSON.stringify(data.detail);
  } catch {
    /* fall through to status text */
  }
  return res.statusText || `Request failed (${res.status})`;
}

export const api = {
  listProjects: () => request<Project[]>('/projects'),

  createProject: (body: ProjectCreate) =>
    request<Project>('/projects', { method: 'POST', body }),

  updateProject: (id: string, body: ProjectUpdate) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body }),

  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  getGraph: (projectId: string) =>
    request<Graph>('/graph', { query: { project_id: projectId } }),

  getNodeKinds: () => request<NodeKind[]>('/node-kinds'),

  getRelationshipTypes: () => request<RelationshipType[]>('/relationship-types'),

  getRules: () => request<Rule[]>('/rules'),

  createRule: (body: RuleInput) =>
    request<Rule>('/rules', { method: 'POST', body }),

  deleteRule: (ruleId: string) =>
    request<void>(`/rules/${ruleId}`, { method: 'DELETE' }),

  createNode: (projectId: string, body: NodeInput) =>
    request<{ id: string }>('/nodes', {
      method: 'POST',
      body,
      query: { project_id: projectId },
    }),

  updateNode: (projectId: string, nodeId: string, body: NodeInput) =>
    request<{ id: string }>('/nodes', {
      method: 'PATCH',
      body,
      query: { project_id: projectId, node_id: nodeId },
    }),

  deleteNode: (projectId: string, nodeId: string) =>
    request<void>('/nodes', {
      method: 'DELETE',
      query: { project_id: projectId, node_id: nodeId },
    }),

  createEdge: (projectId: string, body: EdgeInput) =>
    request<{ id: string }>('/edges', {
      method: 'POST',
      body,
      query: { project_id: projectId },
    }),

  deleteEdge: (projectId: string, body: EdgeRef) =>
    request<void>('/edges/delete', {
      method: 'POST',
      body,
      query: { project_id: projectId },
    }),

  importSchema: (projectId: string, body: SchemaImport) =>
    request<Graph>('/schema/import', {
      method: 'POST',
      body,
      query: { project_id: projectId },
    }),

  getGlossary: (projectId: string) =>
    request<GlossaryTerm[]>('/glossary', { query: { project_id: projectId } }),

  getInventory: (projectId: string) =>
    request<InventoryItem[]>('/inventory', { query: { project_id: projectId } }),

  llmMutate: (projectId: string, prompt: string, apply: boolean) =>
    request<LLMMutateResult>('/llm/mutate', {
      method: 'POST',
      body: { prompt, apply },
      query: { project_id: projectId },
    }),

  // Staged flow: propose changes (no mutation), then apply the approved batch.
  llmPropose: (projectId: string, prompt: string) =>
    request<LLMProposeResult>('/llm/propose', {
      method: 'POST',
      body: { prompt },
      query: { project_id: projectId },
    }),

  applyOperations: (projectId: string, operations: LlmOperation[]) =>
    request<OperationsApplyResult>('/operations/apply', {
      method: 'POST',
      body: { operations },
      query: { project_id: projectId },
    }),

  sparqlQuery: (projectId: string, query: string) =>
    request<SparqlResult>('/sparql', {
      method: 'POST',
      body: { query },
      query: { project_id: projectId },
    }),

  sparqlNl: (projectId: string, question: string) =>
    request<SparqlResult>('/sparql/nl', {
      method: 'POST',
      body: { question },
      query: { project_id: projectId },
    }),

  getHistory: (projectId: string, limit = 100) =>
    request<HistoryEvent[]>('/history', { query: { project_id: projectId, limit: String(limit) } }),

  getLLMSettings: () => request<LLMSettings>('/settings/llm'),

  updateLLMSettings: (body: LLMSettingsUpdate) =>
    request<LLMSettings>('/settings/llm', { method: 'PATCH', body }),

  listOllamaModels: () => request<OllamaModel[]>('/settings/llm/models'),

  listSnapshots: (projectId: string) =>
    request<Snapshot[]>('/snapshots', { query: { project_id: projectId } }),

  createSnapshot: (projectId: string, body: SnapshotInput) =>
    request<Snapshot>('/snapshots', {
      method: 'POST',
      body,
      query: { project_id: projectId },
    }),

  restoreSnapshot: (projectId: string, snapshotId: string) =>
    request<Graph>(`/snapshots/${snapshotId}/restore`, {
      method: 'POST',
      query: { project_id: projectId },
    }),

  shipSnapshot: (projectId: string, snapshotId: string) =>
    request<Snapshot>(`/snapshots/${snapshotId}/ship`, {
      method: 'POST',
      query: { project_id: projectId },
    }),

  getSnapshotTtl: (projectId: string, snapshotId: string) =>
    fetch(`${API_BASE_URL}/api/snapshots/${snapshotId}/ttl?project_id=${projectId}`)
      .then((r) => r.text()),

  getSnapshotGraph: (projectId: string, snapshotId: string) =>
    request<Graph>(`/snapshots/${snapshotId}/graph`, { query: { project_id: projectId } }),
};
