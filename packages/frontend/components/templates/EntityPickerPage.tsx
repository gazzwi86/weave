import { EntityPickerModal, type EntityPickerModalProps, type EntityPickerOption } from "@/components/organisms/EntityPickerModal";

export type { EntityPickerModalProps, EntityPickerOption };

/** Pass-through template (`DrawerPage`'s sibling) so app/** can reach
 * `EntityPickerModal` through the atomic-design import boundary
 * (`lint-import-boundary.ts`) instead of importing the organism directly. */
export function EntityPickerPage(props: EntityPickerModalProps) {
  return <EntityPickerModal {...props} />;
}
