"use client";

import type { DragEvent } from "react";
import { useState } from "react";

import type { WidgetOut } from "./types";
import { WidgetTile } from "./widget-tile";

/** AC-5: swaps two ids' positions in an id-ordered list -- used by both
 * drag-drop and the keyboard move-up/down alternative so there's one
 * reorder-math implementation. */
function moveId(ids: string[], id: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  const a = next[index] as string;
  const b = next[target] as string;
  next[index] = b;
  next[target] = a;
  return next;
}

export interface WidgetGridProps {
  widgets: WidgetOut[];
  /** AC-1/AC-6: pin/unpin only apply to `scope='user'` rows -- omitted
   * (read-only grid) when the caller has no user session to act as. */
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  /** AC-5: called with the full reordered id list for `scope='user'`
   * widgets only -- `tenant_default` tiles aren't reorderable (Design
   * Decisions table). */
  onReorder?: (idsInOrder: string[]) => void;
  /** TASK-015 AC-1: publish a `scope='user'` widget to the tenant library. */
  onPublish?: (id: string) => void;
}

interface TilePropsArgs {
  widget: WidgetOut;
  onPin?: (id: string) => void;
  onUnpin?: (id: string) => void;
  onReorder?: (idsInOrder: string[]) => void;
  onPublish?: (id: string) => void;
  userIds: string[];
  reorderUser: (nextUserIds: string[]) => void;
  setDragId: (id: string | null) => void;
  handleDrop: (targetId: string) => void;
}

function dragHandleFor(
  widget: WidgetOut,
  setDragId: (id: string | null) => void,
  handleDrop: (targetId: string) => void
) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      setDragId(widget.id);
    },
    onDragOver: (event: DragEvent) => event.preventDefault(),
    onDrop: () => handleDrop(widget.id),
  };
}

function pinHandlers(widget: WidgetOut, isUser: boolean, onPin?: (id: string) => void, onUnpin?: (id: string) => void) {
  if (!isUser) return { onPin: undefined, onUnpin: undefined };
  return {
    onPin: onPin ? () => onPin(widget.id) : undefined,
    onUnpin: onUnpin ? () => onUnpin(widget.id) : undefined,
  };
}

/** TASK-015 AC-1: publish only ever applies to `scope='user'` rows -- same
 * gating as pin/unpin above. */
function publishHandler(widget: WidgetOut, isUser: boolean, onPublish?: (id: string) => void) {
  if (!isUser || !onPublish) return undefined;
  return () => onPublish(widget.id);
}

function moveHandlers(widget: WidgetOut, canReorder: boolean, userIds: string[], reorderUser: (ids: string[]) => void) {
  if (!canReorder) return { onMoveUp: undefined, onMoveDown: undefined };
  return {
    onMoveUp: () => reorderUser(moveId(userIds, widget.id, -1)),
    onMoveDown: () => reorderUser(moveId(userIds, widget.id, 1)),
  };
}

/** Extracted from the render loop so complexity stays under the per-widget
 * conditional wiring -- keeps `WidgetGrid` itself simple. */
function tileProps({ widget, onPin, onUnpin, onReorder, onPublish, userIds, reorderUser, setDragId, handleDrop }: TilePropsArgs) {
  const isUser = widget.scope === "user";
  const canReorder = isUser && Boolean(onReorder);
  return {
    ...pinHandlers(widget, isUser, onPin, onUnpin),
    ...moveHandlers(widget, canReorder, userIds, reorderUser),
    onPublish: publishHandler(widget, isUser, onPublish),
    dragHandleProps: canReorder ? dragHandleFor(widget, setDragId, handleDrop) : undefined,
  };
}

/** AC-3: the bento dashboard grid (layout-grid.md). 12-col track at
 * `lg`+ with per-tile spans from `spec.column_span`; single column below
 * `lg` (the intermediate 2/3-col reclamp tiers aren't built -- ponytail:
 * add if a denser breakpoint step is actually requested).
 *
 * AC-5: drag-reorder via native HTML5 DnD (draggable + onDrop, widget id
 * in dataTransfer -- never index, which drifts under concurrent
 * re-renders) plus a keyboard move-up/down alternative, both calling the
 * same `moveId` reorder math and only ever reordering `scope='user'` rows.
 */
export function WidgetGrid({ widgets, onPin, onUnpin, onReorder, onPublish }: WidgetGridProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const ordered = [...widgets].sort((a, b) => a.position - b.position);
  const userIds = ordered.filter((w) => w.scope === "user").map((w) => w.id);

  function reorderUser(nextUserIds: string[]): void {
    if (onReorder && nextUserIds.join(",") !== userIds.join(",")) onReorder(nextUserIds);
  }

  function handleDrop(targetId: string): void {
    if (dragId === null || dragId === targetId) return;
    const from = userIds.indexOf(dragId);
    const to = userIds.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...userIds];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    reorderUser(next);
    setDragId(null);
  }

  return (
    <div className="grid w-full grid-cols-1 gap-[var(--space-6)] lg:grid-cols-12">
      {ordered.map((widget) => (
        <WidgetTile
          key={widget.id}
          widget={widget}
          style={{ gridColumn: `span ${widget.spec.column_span} / span 12` }}
          {...tileProps({ widget, onPin, onUnpin, onReorder, onPublish, userIds, reorderUser, setDragId, handleDrop })}
        />
      ))}
    </div>
  );
}
