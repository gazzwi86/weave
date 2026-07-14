import { ExerciseSchema, type Exercise } from "./schema";

const allPaths = ["business", "technical", "compliance", "admin"] as const;

// The unowned-process SPARQL ASK CE-03/CE-03b both verify against (PRD
// E4-S1 exercise table: "Process nodes with no performedBy Actor").
// `weave:label`, not `rdfs:label` -- ADR-005 (see rdf/patterns.py).
const UNOWNED_PROCESS_ASK =
  "PREFIX weave: <https://weave.io/ontology/>\n" +
  "ASK { GRAPH ?g { ?p a weave:Process . FILTER NOT EXISTS { ?p weave:performedBy ?a } } }";

const ce01: Exercise = {
  exerciseId: "CE-01",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-01.goal",
  stepKeys: ["onboarding.exercise.ce-01.step1", "onboarding.exercise.ce-01.step2", "onboarding.exercise.ce-01.step3"],
  // Both the entity-list and missing-property views must be visited in one
  // session (Implementation Hints) -- the one deliberately soft/client-signal
  // check (PRD marks CE-01 a UI-nav signal), kept honest by requiring both.
  completion: { kind: "nav_signal", signal: "entity-list-viewed,missing-property-viewed" },
};

/** Verified server-side by static ASK over the sandbox graph, after the
 * NL write commits via CE-WRITE-1 (AC-009-02/03). */
const ce02: Exercise = {
  exerciseId: "CE-02",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-02.goal",
  stepKeys: ["onboarding.exercise.ce-02.step1", "onboarding.exercise.ce-02.step2", "onboarding.exercise.ce-02.step3"],
  completion: {
    kind: "sparql_ask",
    ask:
      "PREFIX weave: <https://weave.io/ontology/>\n" +
      'ASK { GRAPH ?g { ?s a weave:Class ; weave:label "Outdoor Furniture" } }',
  },
};

/** Technical-only (FR-016). */
const ce03: Exercise = {
  exerciseId: "CE-03",
  paths: ["technical"],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-03.goal",
  stepKeys: ["onboarding.exercise.ce-03.step1", "onboarding.exercise.ce-03.step2", "onboarding.exercise.ce-03.step3"],
  completion: { kind: "sparql_ask", ask: UNOWNED_PROCESS_ASK },
};

/** Business (FR-016) -- the guided NL equivalent of CE-03's raw-SPARQL
 * exercise; same underlying fact, same ASK (AC-009-06). */
const ce03b: Exercise = {
  exerciseId: "CE-03b",
  paths: ["business", "compliance", "admin"],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-03b.goal",
  stepKeys: ["onboarding.exercise.ce-03b.step1", "onboarding.exercise.ce-03b.step2", "onboarding.exercise.ce-03b.step3"],
  completion: { kind: "sparql_ask", ask: UNOWNED_PROCESS_ASK },
};

const ge01: Exercise = {
  exerciseId: "GE-01",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ge-01.goal",
  stepKeys: ["onboarding.exercise.ge-01.step1", "onboarding.exercise.ge-01.step2", "onboarding.exercise.ge-01.step3"],
  completion: { kind: "canvas_state", state: "spotlight-active" },
};

const ge02: Exercise = {
  exerciseId: "GE-02",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ge-02.goal",
  stepKeys: ["onboarding.exercise.ge-02.step1", "onboarding.exercise.ge-02.step2", "onboarding.exercise.ge-02.step3"],
  completion: { kind: "canvas_state", state: "heatmap-overlay-active" },
};

export const EXERCISES: Exercise[] = [ce01, ce02, ce03, ce03b, ge01, ge02].map((e) => ExerciseSchema.parse(e));
