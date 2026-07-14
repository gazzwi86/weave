import { BeaconSchema, type Beacon } from "./schema";

const ceVersions: Beacon = {
  beaconId: "ce-versions",
  anchorId: "ce.versions",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  bodyKey: "onboarding.beacon.ce-versions.body",
};

// M2 beacons, one per M2 tour's primary anchor (m2-delta.md §3–§4).
const geCompletenessMapBeacon: Beacon = {
  beaconId: "ge-completeness-map",
  anchorId: "ge.overlay.completeness-legend",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m2",
  bodyKey: "onboarding.beacon.ge-completeness-map.body",
};

const platRoleHomeBeacon: Beacon = {
  beaconId: "plat-role-home",
  anchorId: "plat.role-home.completeness-map",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m2",
  bodyKey: "onboarding.beacon.plat-role-home.body",
};

const geTrustMechanicsBeacon: Beacon = {
  beaconId: "ge-trust-mechanics",
  anchorId: "ge.versions.panel",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m2",
  bodyKey: "onboarding.beacon.ge-trust-mechanics.body",
};

// m2-delta.md §3 re-anchoring note: the CE beacon is dropped -- rules &
// policies has no run-report control to hint at, and AC-004-03 scopes the
// M2 trust-mechanics beacon budget to the one on ge.versions.panel only.

export const BEACONS: Beacon[] = [
  ceVersions,
  geCompletenessMapBeacon,
  platRoleHomeBeacon,
  geTrustMechanicsBeacon,
].map((b) => BeaconSchema.parse(b));
