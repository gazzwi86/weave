"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { Toast, type ToastVariant } from "./toast";

export interface ToastInput {
  message: ReactNode;
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
}

interface ToastEntry extends Required<Pick<ToastInput, "message" | "variant">> {
  id: number;
  action?: ToastInput["action"];
  closing: boolean;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ponytail: toast lifetime/exit-transition timing are UX constants
// (refit-mock.html's `toast()` JS), not design tokens -- --duration-*
// tokens govern transition *curves*, not "how long before this disappears".
const AUTO_DISMISS_MS = 5200;
const EXIT_TRANSITION_MS = 320; // matches --duration-slow

/** refit-mock.html `.toast-stack` -- bottom-right stack, one live region per
 * toast. Owns the auto-dismiss timer and the closing-frame window; `Toast`
 * itself stays presentational (see toast.tsx). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const requestClose = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((entry) => (entry.id === id ? { ...entry, closing: true } : entry)));
      setTimeout(() => remove(id), EXIT_TRANSITION_MS);
    },
    [remove]
  );

  const toast = useCallback(
    ({ message, variant = "info", action }: ToastInput) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant, action, closing: false }]);
      setTimeout(() => requestClose(id), AUTO_DISMISS_MS);
    },
    [requestClose]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-[var(--space-5)] right-[var(--space-5)] z-[var(--z-toast)] flex flex-col items-end gap-[var(--space-2)]">
        {toasts.map((entry) => (
          <Toast
            key={entry.id}
            message={entry.message}
            variant={entry.variant}
            action={entry.action}
            closing={entry.closing}
            onDismiss={() => requestClose(entry.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Throws outside a ToastProvider -- fail loudly rather than silently drop
 * a caller's feedback toast. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
