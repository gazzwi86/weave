import { useId } from "react";

import { cn } from "@/lib/utils";

export interface LogoMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Weave node-graph "W" mark (docs/design/logo-mark.svg) -- inline SVG so
 * the rail can size/tint it without shipping a padded raster (visual-
 * direction.md: logo.png has padding and must not ship as-is). Default size
 * matches the icon rail's mock (refit-mock.html .rail-logo, sized ~26 units).
 * Gradient ids are instance-scoped via useId -- two mounted LogoMarks on one
 * page would otherwise collide on the same #lgAB etc. id. Stop/fill colours
 * reuse the existing --color-series-1/2/3/5/6 tokens (identical hex to the
 * mock's brand-spectrum stops), never raw hex.
 */
export function LogoMark({ size = 26, className }: LogoMarkProps) {
  const uid = useId();
  const gid = (name: string) => `${uid}-${name}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Weave"
      className={cn(className)}
    >
      <defs>
        <linearGradient id={gid("lgAB")} x1="6" y1="14" x2="16" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-series-1)" />
          <stop offset="1" stopColor="var(--color-series-3)" />
        </linearGradient>
        <linearGradient id={gid("lgBC")} x1="16" y1="50" x2="32" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-series-3)" />
          <stop offset="1" stopColor="var(--color-series-5)" />
        </linearGradient>
        <linearGradient id={gid("lgCD")} x1="32" y1="22" x2="48" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-series-5)" />
          <stop offset="1" stopColor="var(--color-series-2)" />
        </linearGradient>
        <linearGradient id={gid("lgDE")} x1="48" y1="50" x2="58" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-series-2)" />
          <stop offset="1" stopColor="var(--color-series-6)" />
        </linearGradient>
      </defs>
      <g strokeWidth="5" strokeLinecap="round">
        <line x1="6" y1="14" x2="16" y2="50" stroke={`url(#${gid("lgAB")})`} />
        <line x1="16" y1="50" x2="32" y2="22" stroke={`url(#${gid("lgBC")})`} />
        <line x1="32" y1="22" x2="48" y2="50" stroke={`url(#${gid("lgCD")})`} />
        <line x1="48" y1="50" x2="58" y2="14" stroke={`url(#${gid("lgDE")})`} />
      </g>
      <g>
        <circle cx="6" cy="14" r="5.5" fill="var(--color-series-1)" />
        <circle cx="16" cy="50" r="5.5" fill="var(--color-series-3)" />
        <circle cx="32" cy="22" r="5.5" fill="var(--color-series-5)" />
        <circle cx="48" cy="50" r="5.5" fill="var(--color-series-2)" />
        <circle cx="58" cy="14" r="5.5" fill="var(--color-series-6)" />
      </g>
    </svg>
  );
}
