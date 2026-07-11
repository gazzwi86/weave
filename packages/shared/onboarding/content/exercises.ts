import { ExerciseSchema, type Exercise } from "./schema";

const allPaths = ["business", "technical", "compliance", "admin"] as const;

const ce01: Exercise = {
  exerciseId: "CE-01",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-01.goal",
  stepKeys: ["onboarding.exercise.ce-01.step1", "onboarding.exercise.ce-01.step2", "onboarding.exercise.ce-01.step3"],
  completion: { kind: "nav_signal", signal: "entity-detail-viewed" },
};

const ce02: Exercise = {
  exerciseId: "CE-02",
  paths: [...allPaths],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-02.goal",
  stepKeys: ["onboarding.exercise.ce-02.step1", "onboarding.exercise.ce-02.step2", "onboarding.exercise.ce-02.step3"],
  completion: { kind: "nav_signal", signal: "nl-query-answered" },
};

/** Technical-only (FR-016). */
const ce03: Exercise = {
  exerciseId: "CE-03",
  paths: ["technical"],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-03.goal",
  stepKeys: ["onboarding.exercise.ce-03.step1", "onboarding.exercise.ce-03.step2", "onboarding.exercise.ce-03.step3"],
  completion: { kind: "sparql_ask", ask: "ASK { ?s ?p ?o }" },
};

/** Business (FR-016) -- the guided equivalent of CE-03's raw-SPARQL exercise. */
const ce03b: Exercise = {
  exerciseId: "CE-03b",
  paths: ["business", "compliance", "admin"],
  phase: "m1",
  goalKey: "onboarding.exercise.ce-03b.goal",
  stepKeys: ["onboarding.exercise.ce-03b.step1", "onboarding.exercise.ce-03b.step2", "onboarding.exercise.ce-03b.step3"],
  completion: { kind: "write_commit" },
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
  completion: { kind: "nav_signal", signal: "two-hop-traced" },
};

export const EXERCISES: Exercise[] = [ce01, ce02, ce03, ce03b, ge01, ge02].map((e) => ExerciseSchema.parse(e));
