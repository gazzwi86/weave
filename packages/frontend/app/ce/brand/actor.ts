/** The session's user email, for display-only PROV attribution (matches
 * `/api/operations/apply`'s own server-side `actor` derivation --
 * `session.user?.email`). Never used for authorization; the backend
 * derives its own copy from the same session server-side. Reuses
 * next-auth's built-in `/api/auth/session` route -- nothing new to build.
 */
export async function currentActorIri(): Promise<string> {
  const res = await fetch("/api/auth/session");
  if (!res.ok) return "unknown-actor";
  const body = (await res.json()) as { user?: { email?: string } };
  return body.user?.email ?? "unknown-actor";
}
