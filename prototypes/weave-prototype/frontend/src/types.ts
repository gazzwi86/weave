// Shared TS types mirroring the FastAPI contract.

export interface Project {
  id: string;
  name: string;
  description: string;
  created: string;
  is_demo: boolean;
  node_count: number;
  edge_count: number;
}

export type ProjectSeed = 'empty' | 'demo' | 'turtle';

export interface ProjectCreate {
  name: string;
  description?: string;
  seed: ProjectSeed;
  turtle?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  color: string;
  comment?: string | null;
  note?: string | null;
  domain?: string | null;
  capability?: string | null;
  maturity?: string | null;
  target_maturity?: string | null;
  strategic_importance?: string | null;
  investment_level?: string | null;
  lifecycle_status?: string | null;
  capability_owner?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  comment?: string | null;
  note?: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeKind {
  key: string;
  iri: string;
  color: string;
}

export interface RelationshipType {
  key: string;
  iri: string;
  label: string;
}

/** A human-readable if/then rule derived from the SHACL constraint shapes. */
export interface Rule {
  id: string;
  category: string;
  relationship: string;
  object_kind: string;
  object_kind_curie: string;
  severity: string;
  message?: string | null;
  is_custom?: boolean;
}

export interface RuleInput {
  relationship: string;
  object_kind: string;
  severity?: string;
  message?: string | null;
}

export interface NodeInput {
  label: string;
  kind?: string | null;
  comment?: string | null;
  note?: string | null;
  color?: string | null;
  domain?: string | null;
  capability?: string | null;
  maturity?: string | null;
  target_maturity?: string | null;
  strategic_importance?: string | null;
  investment_level?: string | null;
  lifecycle_status?: string | null;
  capability_owner?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface EdgeInput {
  source: string;
  target: string;
  type: string;
  comment?: string | null;
  note?: string | null;
}

export interface EdgeRef {
  source: string;
  target: string;
  type: string;
}

export interface GlossaryTerm {
  id: string;
  label: string;
  definition?: string | null;
  related: string[];
}

export interface InventoryItem {
  id: string;
  label: string;
  kind: string;
  comment?: string | null;
  domain?: string | null;
  capability?: string | null;
  depends_on: string[];
}

export interface MutationOp {
  op: string;
  summary: string;
  detail: Record<string, unknown>;
}

export interface LLMMutateResult {
  message: string;
  applied: boolean;
  operations: MutationOp[];
  graph?: Graph | null;
}

/** A raw LLM-proposed operation (shape varies by `op`). */
export interface LlmOperation {
  op: string;
  [key: string]: unknown;
}

export interface LLMProposeResult {
  message: string;
  operations: LlmOperation[];
}

export interface OperationsApplyResult {
  applied: boolean;
  operations: MutationOp[];
  graph?: Graph | null;
}

export type SchemaFormat = 'csv' | 'json_schema';

export interface SchemaImport {
  name: string;
  format: SchemaFormat;
  content: string;
  concept?: string | null;
}

export interface SparqlResult {
  columns: string[];
  rows: Record<string, string | null>[];
  generated_sparql?: string | null;
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  agent: 'user' | 'llm' | string;
  summary: string;
  operations: Array<{ op: string; summary: string; detail?: Record<string, unknown> }>;
}

export interface LLMSettings {
  provider: 'anthropic' | 'ollama' | string;
  model: string;
  ollama_url: string;
  anthropic_configured: boolean;
}

export interface LLMSettingsUpdate {
  provider?: string;
  model?: string;
  ollama_url?: string;
}

export interface OllamaModel {
  name: string;
  size?: number | null;
  modified_at?: string | null;
}

export interface Snapshot {
  id: string;
  label: string;
  description: string;
  created: string;
  node_count: number;
  edge_count: number;
  status: 'draft' | 'released' | 'deprecated';
}

export interface SnapshotInput {
  label: string;
  description?: string;
}

export type DiffStatus = 'added' | 'removed' | 'modified';
export type DiffMap = Map<string, DiffStatus>;
