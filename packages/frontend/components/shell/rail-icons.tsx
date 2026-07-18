import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";

/** Icon rail glyphs, keyed by each IA area's `href` (nav-items.ts). Path
 * data is the Icon atom's, copied verbatim from refit-mock.html's sprite. */
const RAIL_ICON_NAMES: Record<string, IconName> = {
  "/dashboard": "home",
  "/ce": "graph",
  "/build": "layers",
  "/events": "zap",
  "/audit": "scroll",
  "/settings": "gear",
};

export const RAIL_ICONS: Record<string, ReactNode> = Object.fromEntries(
  Object.entries(RAIL_ICON_NAMES).map(([href, name]) => [href, <Icon key={href} name={name} size={20} />])
);
