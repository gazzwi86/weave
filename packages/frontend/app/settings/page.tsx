import { redirect } from "next/navigation";

/** Settings has no index of its own — land on the first rail item. */
export default function SettingsPage() {
  redirect("/settings/models");
}
