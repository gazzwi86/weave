export interface SearchableNode {
  id: string;
  label?: string;
  bpmoKind?: string;
}

/** AC-5: client-side-only search match -- case-insensitive substring on
 * label or entity-type (bpmoKind). No CE call involved. */
export function matchesSearchQuery(node: SearchableNode, query: string): boolean {
  const needle = query.toLowerCase();
  return Boolean(node.label?.toLowerCase().includes(needle) || node.bpmoKind?.toLowerCase().includes(needle));
}
