import { RelationshipsEditor, type Relationship, type RelationshipsEditorProps } from "@/components/molecules/RelationshipsEditor";

export type { Relationship };

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`PageHeaderSlot`. Lets a page's
 * `EntityEditDrawer` relationships slot render `RelationshipsEditor` without
 * reaching past the template layer into a raw molecule.
 */
export function RelationshipsEditorSlot(props: RelationshipsEditorProps) {
  return <RelationshipsEditor {...props} />;
}
