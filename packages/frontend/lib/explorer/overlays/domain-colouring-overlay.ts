import { lastIriSegment } from "../map-rows-to-elements";
import type { Overlay, OverlayLegendEntry, OverlayLegendModel } from "../overlay-engine";
import type { CytoscapeElement } from "../types";

export interface DomainColouringConfig {
  /** Bulk-loaded edge label to read domain membership from (config.ts's
   * domainMembershipPredicate) -- never fetched separately. */
  membershipPredicate: string;
  /** Categorical series palette, cycled on overflow (AC-3). */
  palette: string[];
  /** Fallback colour for a node with no domain-membership edge. */
  noneColour: string;
}

interface MembershipResult {
  /** nodeId -> its first-listed domain id (implementation hint tie-break). */
  domainByNode: Map<string, string>;
  /** node ids that had more than one membership edge -- tie-break applied. */
  multiDomainNodeIds: Set<string>;
}

/** AC-3/Implementation hints: domain membership comes from the already-
 * loaded edges (never an additional fetch) -- an edge whose label is the
 * membership predicate is `node -> domain`. First-listed edge per node wins
 * when a node has more than one (multi-domain), and that tie-break is
 * surfaced in the legend note rather than silently dropped. */
function readMembership(elements: CytoscapeElement[], membershipPredicate: string): MembershipResult {
  const domainByNode = new Map<string, string>();
  const multiDomainNodeIds = new Set<string>();

  for (const element of elements) {
    if (element.data.source === undefined || element.data.label !== membershipPredicate) continue;
    const nodeId = element.data.source;
    const domainId = element.data.target;
    if (nodeId === undefined || domainId === undefined) continue;
    if (domainByNode.has(nodeId)) {
      multiDomainNodeIds.add(nodeId);
      continue;
    }
    domainByNode.set(nodeId, domainId);
  }

  return { domainByNode, multiDomainNodeIds };
}

function domainLabel(elements: CytoscapeElement[], domainId: string): string {
  const domainElement = elements.find((el) => el.data.id === domainId);
  return domainElement?.data.label ?? lastIriSegment(domainId);
}

// config.palette is a non-empty design-token list (ExplorerConfig invariant,
// same as fcoseParams/layoutSaveRetryDelaysMs) -- the modulo index is always
// in range, so the non-null assertion documents that rather than masking it.
function assignColours(domainIds: string[], palette: string[]): Map<string, string> {
  const colourByDomain = new Map<string, string>();
  domainIds.forEach((domainId, index) => {
    colourByDomain.set(domainId, palette[index % palette.length]!);
  });
  return colourByDomain;
}

function buildNote(cycled: boolean, hasMultiDomainNodes: boolean): string | undefined {
  const notes: string[] = [];
  if (cycled) notes.push("palette cycled -- more domains than colours");
  if (hasMultiDomainNodes) notes.push("a node with multiple domains uses its first-listed domain");
  return notes.length > 0 ? notes.join("; ") : undefined;
}

/** FR-018/AC-3: colours nodes by domain membership; more domains than
 * palette slots cycles the palette (legend notes it). */
export function createDomainColouringOverlay(config: DomainColouringConfig): Overlay {
  let lastEntries: OverlayLegendEntry[] = [];
  let lastNote: string | undefined;

  return {
    id: "domain-colouring",
    exclusiveGroup: "colour",
    apply(adapter) {
      const elements = adapter.listElements();
      const { domainByNode, multiDomainNodeIds } = readMembership(elements, config.membershipPredicate);
      const domainIds = [...new Set(domainByNode.values())].sort();
      const colourByDomain = assignColours(domainIds, config.palette);

      const colourByNodeId: Record<string, string> = {};
      for (const [nodeId, domainId] of domainByNode) {
        colourByNodeId[nodeId] = colourByDomain.get(domainId)!;
      }
      adapter.applyNodeColours(colourByNodeId, config.noneColour);

      lastEntries = domainIds.map((domainId) => ({ label: domainLabel(elements, domainId), colour: colourByDomain.get(domainId)! }));
      lastNote = buildNote(domainIds.length > config.palette.length, multiDomainNodeIds.size > 0);
    },
    remove(adapter) {
      adapter.clearNodeColours();
    },
    legend(): OverlayLegendModel {
      return { title: "Domain colouring", entries: lastEntries, note: lastNote };
    },
  };
}
