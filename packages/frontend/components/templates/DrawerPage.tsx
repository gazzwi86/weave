import { Drawer, type DrawerProps } from "@/components/organisms/Drawer";

export type { DrawerSize } from "@/components/organisms/Drawer";

/** Pass-through template (`ExpandableDataTable`'s sibling) for pages that
 * need `Drawer`'s raw chrome -- custom fields, footer and dangerSlot --
 * rather than `EntityEditDrawer`'s fixed label/description shape. The
 * app-layer boundary rule (`lint-import-boundary.ts`) requires app/** to
 * reach `Drawer` through a template, not directly. */
export function DrawerPage(props: DrawerProps) {
  return <Drawer {...props} />;
}
