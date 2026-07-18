import { TypeaheadField, type TypeaheadFieldProps } from "@/components/molecules/TypeaheadField";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`KpiTileSlot`. Lets pages consume
 * the shared `TypeaheadField` molecule without importing the molecule layer
 * themselves.
 */
export function TypeaheadFieldSlot(props: TypeaheadFieldProps) {
  return <TypeaheadField {...props} />;
}

export type { TypeaheadOption } from "@/components/molecules/TypeaheadField";
