import { describe, expect, it } from "vitest";

import { groupBellEntries, type BellNotification } from "../group-bell-entries";

const SESSION_START = "2026-07-09T00:00:00.000Z";

function published(id: string, semver: string, createdAt: string): BellNotification {
  return {
    id,
    event_type: "model.version.published",
    payload: { semver },
    read: false,
    created_at: createdAt,
  };
}

describe("groupBellEntries", () => {
  it("returns an empty list for no notifications", () => {
    expect(groupBellEntries([], SESSION_START)).toEqual([]);
  });

  it("collapses consecutive model.version.published notifications from the same session into one summary row", () => {
    const notifications = [
      published("n-1", "0.3.0", "2026-07-09T01:00:00.000Z"),
      published("n-2", "0.3.4", "2026-07-09T02:00:00.000Z"),
    ];
    const grouped = groupBellEntries(notifications, SESSION_START);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.summary).toBe("0.3.0 → 0.3.4 published");
    expect(grouped[0]?.batchedCount).toBe(2);
    expect(grouped[0]?.id).toBe("n-2");
  });

  it("does not batch a model.version.published notification created before the current session started", () => {
    const notifications = [
      published("n-0", "0.2.9", "2026-07-08T12:00:00.000Z"),
      published("n-1", "0.3.0", "2026-07-09T01:00:00.000Z"),
    ];
    const grouped = groupBellEntries(notifications, SESSION_START);
    expect(grouped).toHaveLength(2);
    expect(grouped.some((entry) => entry.id === "n-0" && !entry.summary)).toBe(true);
  });

  it("leaves non-version-published notifications untouched and returns newest first", () => {
    const notifications: BellNotification[] = [
      { id: "n-1", event_type: "job.completed", payload: {}, read: false, created_at: "2026-07-09T01:00:00.000Z" },
      { id: "n-2", event_type: "audit.chain.invalid", payload: {}, read: false, created_at: "2026-07-09T03:00:00.000Z" },
    ];
    const grouped = groupBellEntries(notifications, SESSION_START);
    expect(grouped.map((e) => e.id)).toEqual(["n-2", "n-1"]);
  });

  it("does not batch a single same-session publish (no summary on a lone entry)", () => {
    const grouped = groupBellEntries([published("n-1", "0.3.0", "2026-07-09T01:00:00.000Z")], SESSION_START);
    expect(grouped[0]?.summary).toBeUndefined();
  });
});
