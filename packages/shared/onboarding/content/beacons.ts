import { BeaconSchema, type Beacon } from "./schema";

const ceVersions: Beacon = {
  beaconId: "ce-versions",
  anchorId: "ce.versions",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  bodyKey: "onboarding.beacon.ce-versions.body",
};

export const BEACONS: Beacon[] = [ceVersions].map((b) => BeaconSchema.parse(b));
