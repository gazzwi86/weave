// TanStack Query hooks wrapping the api client.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  EdgeInput,
  EdgeRef,
  LLMSettingsUpdate,
  LlmOperation,
  NodeInput,
  ProjectCreate,
  ProjectUpdate,
  RuleInput,
  SchemaImport,
  SnapshotInput,
} from '../types';

export const queryKeys = {
  projects: ['projects'] as const,
  nodeKinds: ['node-kinds'] as const,
  relationshipTypes: ['relationship-types'] as const,
  rules: ['rules'] as const,
  llmSettings: ['llm-settings'] as const,
  graph: (projectId: string) => ['graph', projectId] as const,
  glossary: (projectId: string) => ['glossary', projectId] as const,
  inventory: (projectId: string) => ['inventory', projectId] as const,
  history: (projectId: string) => ['history', projectId] as const,
  snapshots: (projectId: string) => ['snapshots', projectId] as const,
};

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
}

export function useNodeKinds() {
  return useQuery({
    queryKey: queryKeys.nodeKinds,
    queryFn: api.getNodeKinds,
    staleTime: Infinity,
  });
}

export function useRelationshipTypes() {
  return useQuery({
    queryKey: queryKeys.relationshipTypes,
    queryFn: api.getRelationshipTypes,
    staleTime: Infinity,
  });
}

export function useRules() {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: api.getRules,
    staleTime: Infinity,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RuleInput) => api.createRule(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.deleteRule(ruleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules }),
  });
}

export function useHistory(projectId: string, limit = 100) {
  return useQuery({
    queryKey: queryKeys.history(projectId),
    queryFn: () => api.getHistory(projectId, limit),
    refetchInterval: 10000, // refresh every 10s to pick up new mutations
  });
}

export function useLLMSettings() {
  return useQuery({
    queryKey: queryKeys.llmSettings,
    queryFn: api.getLLMSettings,
    staleTime: 30000,
  });
}

export function useUpdateLLMSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LLMSettingsUpdate) => api.updateLLMSettings(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.llmSettings }),
  });
}

export function useOllamaModels() {
  return useQuery({
    queryKey: ['ollama-models'] as const,
    queryFn: api.listOllamaModels,
    staleTime: 60000,
    retry: false, // don't retry if Ollama isn't running
  });
}

export function useSnapshots(projectId: string) {
  return useQuery({
    queryKey: queryKeys.snapshots(projectId),
    queryFn: () => api.listSnapshots(projectId),
    staleTime: 0,
  });
}

export function useCreateSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SnapshotInput) => api.createSnapshot(projectId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.snapshots(projectId) });
    },
  });
}

export function useRestoreSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) => api.restoreSnapshot(projectId, snapshotId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.graph(projectId) });
      void qc.invalidateQueries({ queryKey: queryKeys.glossary(projectId) });
      void qc.invalidateQueries({ queryKey: queryKeys.inventory(projectId) });
    },
  });
}

export function useShipSnapshot(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) => api.shipSnapshot(projectId, snapshotId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.snapshots(projectId) }),
  });
}

export function useGraph(projectId: string) {
  return useQuery({
    queryKey: queryKeys.graph(projectId),
    queryFn: () => api.getGraph(projectId),
  });
}

export function useGlossary(projectId: string) {
  return useQuery({
    queryKey: queryKeys.glossary(projectId),
    queryFn: () => api.getGlossary(projectId),
  });
}

export function useInventory(projectId: string) {
  return useQuery({
    queryKey: queryKeys.inventory(projectId),
    queryFn: () => api.getInventory(projectId),
  });
}

/** Invalidate everything that depends on a project's graph data. */
function useInvalidateProject(projectId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.graph(projectId) });
    void qc.invalidateQueries({ queryKey: queryKeys.glossary(projectId) });
    void qc.invalidateQueries({ queryKey: queryKeys.inventory(projectId) });
    void qc.invalidateQueries({ queryKey: queryKeys.projects });
  };
}

export function useCreateNode(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (body: NodeInput) => api.createNode(projectId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateNode(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (vars: { nodeId: string; body: NodeInput }) =>
      api.updateNode(projectId, vars.nodeId, vars.body),
    onSuccess: invalidate,
  });
}

export function useDeleteNode(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (nodeId: string) => api.deleteNode(projectId, nodeId),
    onSuccess: invalidate,
  });
}

export function useCreateEdge(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (body: EdgeInput) => api.createEdge(projectId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteEdge(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (body: EdgeRef) => api.deleteEdge(projectId, body),
    onSuccess: invalidate,
  });
}

export function useImportSchema(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (body: SchemaImport) => api.importSchema(projectId, body),
    onSuccess: invalidate,
  });
}

/** Ask the LLM for a reviewable proposal; does not mutate the graph. */
export function useLlmPropose(projectId: string) {
  return useMutation({
    mutationFn: (prompt: string) => api.llmPropose(projectId, prompt),
  });
}

/** Apply a human-approved batch of operations, then refresh the graph. */
export function useApplyOperations(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (operations: LlmOperation[]) => api.applyOperations(projectId, operations),
    onSuccess: invalidate,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProjectCreate) => api.createProject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; body: ProjectUpdate }) =>
      api.updateProject(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}
