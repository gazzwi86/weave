import { EntityRef, type EntityRefProps } from "@/components/molecules/EntityRef";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `PageHeaderSlot`. AC-9: every principal/machine-id
 * a page renders goes through `EntityRef` (friendly label + mono id), never
 * a raw string, without pages importing the molecule layer themselves.
 */
export function EntityRefSlot(props: EntityRefProps) {
  return <EntityRef {...props} />;
}
