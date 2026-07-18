import { isPlatformOperator } from "@/lib/auth/session-claims";

export interface HeaderScope {
  showHeaderSwitcher: boolean;
  showSettingsWorkspacesEntry: boolean;
}

/**
 * AC-8: the binding tenancy ruling (v1-design-requirements.md R7) retires
 * the GENERAL header workspace switcher -- it never renders for a regular
 * member. Provisioning survives only inside Settings -> Workspaces, gated
 * to the role that can provision workspaces.
 *
 * V6 (2026-07-18, sanctioned exception): a super-admin gets a company
 * switcher in the header (rendered inside the avatar flyout, refit-mock.html
 * "company switcher -- SUPER ADMIN ONLY") because they alone operate across
 * companies -- members never see this section since workspace == company for
 * them. Reuses `isPlatformOperator`, the same predicate the `/operator`
 * route and the avatar-menu "Operator console" item already gate on, so
 * this entry point can't drift from those.
 */
export function resolveHeaderScope(role: string | null): HeaderScope {
  return { showHeaderSwitcher: isPlatformOperator(role), showSettingsWorkspacesEntry: role === "admin" };
}
