import type { ReactNode } from "react";

/** ONB-TASK-008: plants the "settings.page" anchor once for every /settings/*
 * route (shared across the landing page -- General, at /settings itself --
 * and every settings sub-route). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <div data-tour-id="settings.page">{children}</div>;
}
