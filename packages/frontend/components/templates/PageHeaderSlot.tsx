import { PageHeader, type PageHeaderProps } from "@/components/molecules/PageHeader";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`): pages may
 * only reach `components/templates/**`, never a raw molecule directly. This
 * is a pass-through so every page's title/breadcrumb/actions goes through
 * the one `PageHeader` organism (AC-2, F-D07) without pages importing the
 * molecule layer themselves.
 */
export function PageHeaderSlot(props: PageHeaderProps) {
  return <PageHeader {...props} />;
}
