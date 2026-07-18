import { FilterForm, type FilterFormProps } from "@/components/molecules/FilterForm";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`KpiTileSlot`. Lets pages consume
 * the shared `FilterForm` molecule without importing the molecule layer
 * themselves.
 */
export function FilterFormSlot(props: FilterFormProps) {
  return <FilterForm {...props} />;
}

export type { FilterFormField, FilterFormFieldOption } from "@/components/molecules/FilterForm";
