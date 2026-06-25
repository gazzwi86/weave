import type { ReactNode } from 'react';

/** Labelled form row: wraps `div.field` + `<label>` so every form shares the same layout. */
export default function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
