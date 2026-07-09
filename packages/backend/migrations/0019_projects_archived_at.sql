-- TASK-014 (build-engine v1, EPIC-002, ADR-009 Consequences): `projects`
-- gains `archived_at` -- the second of the two nullable columns ADR-009
-- names ("description", already added in 0009, and "archived_at"). No
-- lifecycle-phase column -- phase stays derived at read time (AC-1/B10).
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMPTZ;
