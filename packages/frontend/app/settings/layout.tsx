import type { ReactNode } from "react";

/** ONB-TASK-008: plants the "settings.page" anchor once for every /settings/*
 * route (there's no single settings landing page to attach it to -- /settings
 * itself redirects to /settings/members). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div data-tour-id="settings.page">{children}</div>;
}
