export interface HeaderScope {
  showHeaderSwitcher: boolean;
  showSettingsWorkspacesEntry: boolean;
}

/**
 * AC-8: the binding tenancy ruling (v1-design-requirements.md R7) retires
 * the header workspace switcher entirely -- it never renders, for any role.
 * Provisioning survives only inside Settings -> Workspaces, gated to the
 * role that can provision workspaces.
 *
 * ponytail: no separate `isWeaveSuperAdmin` claim exists yet
 * (PLAT-IDENTITY-1 issues only "admin"/"author" today, see
 * lib/auth/session-claims.ts) -- "admin" stands in for it. Split the two
 * roles apart when a real super-admin claim ships.
 */
export function resolveHeaderScope(role: string | null): HeaderScope {
  return { showHeaderSwitcher: false, showSettingsWorkspacesEntry: role === "admin" };
}
