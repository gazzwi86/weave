"use client";

import { Timeline, type TimelineEntry } from "@/components/molecules/Timeline";
import { Drawer, type DrawerProps } from "@/components/organisms/Drawer";

export type { TimelineEntry, DrawerProps };

export interface VersionsTimelineDrawerProps {
  entries: TimelineEntry[];
  /** Present -> the publish `Drawer` renders alongside the timeline (its
   * own `open` prop controls visibility). */
  drawer?: DrawerProps;
}

/** Published-version `Timeline` + the publish `Drawer`
 * (refit-mock.html `#sub-versions`/`#publish-drawer`) -- `app_layer_boundary`
 * blocks `app/**` from importing `Timeline`/`Drawer` directly, so this
 * template composes them from fully pre-shaped, dumb props; row-shaping
 * and drawer-content-shaping live in `app/ce/versions/version-page-helpers.tsx`
 * and `app/ce/versions/page.tsx` respectively. */
export function VersionsTimelineDrawer({ entries, drawer }: VersionsTimelineDrawerProps) {
  return (
    <>
      <div data-testid="versions-timeline">
        <Timeline entries={entries} />
      </div>
      {drawer && <Drawer {...drawer} />}
    </>
  );
}
