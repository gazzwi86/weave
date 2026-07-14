import { vi } from "vitest";

import type { CyCollection } from "../renderer-adapter";

export function fakeCollection(overrides: Partial<CyCollection> = {}): CyCollection {
  return {
    id: vi.fn(() => "n1"),
    data: vi.fn(() => undefined),
    style: vi.fn(),
    not: vi.fn(() => fakeCollection()),
    length: 1,
    map: vi.fn(() => []),
    filter: vi.fn(() => fakeCollection({ length: 0 })),
    connectedEdges: vi.fn(() => fakeCollection({ length: 0 })),
    addClass: vi.fn(),
    removeClass: vi.fn(),
    hidden: vi.fn(() => false),
    closedNeighborhood: vi.fn(() => fakeCollection()),
    position: vi.fn(() => ({ x: 0, y: 0 })),
    hide: vi.fn(),
    show: vi.fn(),
    ...overrides,
  };
}

export type FakeEvent = { target: unknown; renderedPosition?: { x: number; y: number } };

export function fakeCy() {
  const listenersByEvent = new Map<string, Set<(evt: FakeEvent) => void>>();
  const listenersFor = (event: string) => {
    if (!listenersByEvent.has(event)) listenersByEvent.set(event, new Set());
    return listenersByEvent.get(event)!;
  };
  const fire = (event: string, evt: FakeEvent) => listenersFor(event).forEach((handler) => handler(evt));

  return {
    json: vi.fn(),
    zoom: vi.fn(() => 1.5),
    pan: vi.fn(() => ({ x: 10, y: 20 })),
    layout: vi.fn(() => ({ run: vi.fn() })),
    elements: vi.fn(() => fakeCollection()),
    nodes: vi.fn(() => fakeCollection()),
    edges: vi.fn(() => fakeCollection()),
    getElementById: vi.fn((_id: string) => fakeCollection()),
    batch: vi.fn((fn: () => void) => fn()),
    on: vi.fn((event: string, handler: (evt: FakeEvent) => void) => {
      listenersFor(event).add(handler);
    }),
    off: vi.fn((event: string, handler: (evt: FakeEvent) => void) => {
      listenersFor(event).delete(handler);
    }),
    animate: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    fireTap(target: unknown) {
      fire("tap", { target });
    },
    fireRightClick(target: unknown, renderedPosition: { x: number; y: number }) {
      fire("cxttap", { target, renderedPosition });
    },
    fireDragFree(target: unknown) {
      fire("dragfree", { target });
    },
    fireDoubleClick(target: unknown, renderedPosition: { x: number; y: number }) {
      fire("dbltap", { target, renderedPosition });
    },
    // TASK-023 AC-6: cytoscape-edgehandles' "ehcomplete" fires with extra
    // positional args (sourceNode, targetNode, addedEdge) beyond the usual
    // evt object -- a single-arg `fire()` can't express that, so this is a
    // dedicated helper rather than a fire("ehcomplete", ...) call.
    fireEdgeDrawComplete(sourceId: string, targetId: string, addedEdge: CyCollection = fakeCollection()) {
      const source = fakeCollection({ id: vi.fn(() => sourceId) });
      const target = fakeCollection({ id: vi.fn(() => targetId) });
      listenersFor("ehcomplete").forEach((handler) => {
        (handler as unknown as (evt: undefined, s: CyCollection, t: CyCollection, e: CyCollection) => void)(
          undefined,
          source,
          target,
          addedEdge
        );
      });
    },
    fireRemove(target: unknown) {
      fire("remove", { target });
    },
  };
}
