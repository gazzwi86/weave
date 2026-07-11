import { redirect } from "next/navigation";

/** TASK-030 AC-7: Settings has no index of its own -- Members (the
 * most frequently-needed action, invite/revoke) wins the landing slot
 * over a static overview (`v1-design-requirements.md`).
 */
export default function SettingsPage() {
  redirect("/settings/members");
}
