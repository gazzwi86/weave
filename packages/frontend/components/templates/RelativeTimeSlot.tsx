import { RelativeTime, type RelativeTimeProps } from "@/components/molecules/RelativeTime";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`PageHeaderSlot`. AC-4: every
 * timestamp a page renders goes through `RelativeTime` (friendly relative
 * text + raw ISO hover title), never a bare ISO string.
 */
export function RelativeTimeSlot(props: RelativeTimeProps) {
  return <RelativeTime {...props} />;
}
