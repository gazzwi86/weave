"use client";

import { usePathname } from "next/navigation";

import { NavRail } from "@/components/organisms/NavRail";

import { findSection, PRIMARY_NAV } from "./nav-items";
import { RAIL_ICONS } from "./rail-icons";

/** S4 (docs/design/remediation-2-api-gaps.md): dispatches the same event
 * help-launcher.tsx listens for, so the rail's footer trigger opens the
 * identical Help & learning panel as the header's "?" -- two entry points,
 * one dialog, no duplicated state. */
function openHelpPanel() {
  window.dispatchEvent(new CustomEvent("weave:open-help-panel"));
}

/** The six IA areas (poc-ia-proposal.md §1) rendered as the v5 icon rail;
 * the section owning the current pathname (by prefix, e.g. /audit/compliance
 * -> Audit trail) carries aria-current="page". Presentation lives in the
 * `NavRail` organism -- this wrapper owns routing state and the footer Help
 * trigger only. The footer used to be a decorative, aria-hidden user-initial
 * badge with no click handler ("two help affordances, one dead" -- the real
 * account menu already lives in the header's AvatarMenu); it's a real,
 * keyboard-focusable button now. */
export function Nav() {
  const pathname = usePathname();
  const activeSection = findSection(pathname);

  return (
    <NavRail
      items={PRIMARY_NAV.map((item) => ({
        label: item.label,
        href: item.href,
        icon: RAIL_ICONS[item.href] ?? null,
        disabled: item.disabled,
      }))}
      activeHref={activeSection?.href}
      footer={
        <button
          type="button"
          aria-label="Help"
          onClick={openHelpPanel}
          className="mb-[var(--space-1)] flex h-[30px] w-[30px] items-center justify-center rounded-[var(--radius-full)] bg-[var(--color-accent-soft)] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-accent-primary)] hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        >
          ?
        </button>
      }
    />
  );
}
