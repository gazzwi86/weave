import type { ReactNode } from "react";

import { ToastProvider } from "@/components/ui/toast";

/** Scopes ToastProvider to the Constitution engine routes rather than the
 * root layout — the shell refit lane owns `app/layout.tsx`, this avoids a
 * cross-lane edit conflict there. A future root-level provider would make
 * this redundant (double-mount is harmless, the inner context wins). */
export default function CeLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
