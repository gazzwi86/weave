/**
 * G13 (residual gap): no backend "allowed models" endpoint exists yet, so
 * the tier -> model mapping is a static allow-list here instead of a fetched
 * one. It mirrors CLAUDE.md's confirmed stack verbatim -- one validated
 * model per tier (haiku dropped 2026-07-02, fable dropped 2026-07-09,
 * credits exhausted). Wire this to a real allow-list endpoint when G13
 * ships instead of hand-editing entries.
 */
export interface AllowedModel {
  id: string;
  label: string;
}

export interface AllowedModelTiers {
  high: readonly [AllowedModel];
  mid: readonly [AllowedModel];
}

export const ALLOWED_MODELS: AllowedModelTiers = {
  high: [{ id: "claude-opus-4-8", label: "Claude Opus 4.8" }],
  mid: [{ id: "claude-sonnet-5", label: "Claude Sonnet 5" }],
};
