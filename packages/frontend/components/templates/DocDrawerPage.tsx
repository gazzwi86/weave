import { DocDrawer, type DocDrawerProps } from "@/components/organisms/DocDrawer";

export type DocDrawerPageProps = DocDrawerProps;

/** Thin passthrough of the `DocDrawer` organism -- see `DrawerPage` for why
 * `app/**` needs this crossing point instead of importing the organism
 * directly.
 */
export function DocDrawerPage(props: DocDrawerPageProps) {
  return <DocDrawer {...props} />;
}
