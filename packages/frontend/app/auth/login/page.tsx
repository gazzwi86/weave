import { Button } from "@/components/ui/button";
import { signIn } from "@/auth";

interface LoginPageProps {
  searchParams: Promise<{ return_to?: string }>;
}

/** AC-2: sends the user to the OIDC hosted UI (mock in dev/test, real
 * Cognito later), returning to `return_to` (the page middleware.ts
 * redirected them away from) once signed in.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { return_to } = await searchParams;

  async function signInAction() {
    "use server";
    await signIn("cognito", { redirectTo: return_to ?? "/dashboard" });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-4)]">
      <h1 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)]">
        Sign in to Weave
      </h1>
      <form action={signInAction}>
        <Button type="submit">Sign in with Weave</Button>
      </form>
    </main>
  );
}
