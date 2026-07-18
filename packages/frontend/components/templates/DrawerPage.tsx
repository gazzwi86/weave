import { Drawer, type DrawerProps } from "@/components/organisms/Drawer";

export type { DrawerSize } from "@/components/organisms/Drawer";
export type DrawerPageProps = DrawerProps;

/** Thin passthrough of the `Drawer` organism -- `app/**` may only import
 * `components/templates|pages` (dumb-component boundary), never an organism
 * directly (`lint-import-boundary.ts`). `Drawer` is already fully
 * presentational, so this template adds no logic, only the sanctioned
 * crossing point (same role as `FormDrawerPage`'s wrap of `GlassPanel`).
 */
export function DrawerPage(props: DrawerPageProps) {
  return <Drawer {...props} />;
}
