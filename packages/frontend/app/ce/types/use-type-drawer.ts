"use client";

import { useState } from "react";

import type { KindEntry } from "../chat/types";

export interface TypeDrawerState {
  open: boolean;
  kind: KindEntry | null;
  label: string;
  description: string;
  openNew: () => void;
  openEdit: (kind: KindEntry) => void;
  close: () => void;
  setLabel: (value: string) => void;
  setDescription: (value: string) => void;
}

/** Local edit-drawer draft state for the Types page. Kept out of `page.tsx`
 * to hold the page component under the Law E function-size budget --
 * there is no CE-WRITE-1 op for a SHACL-shape mutation yet (see
 * `types-rows.ts` origin note), so `Save` has nowhere real to persist to;
 * this hook only owns the draft fields, the page wires the not-yet-wired
 * save toast. */
export function useTypeDrawer(): TypeDrawerState {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<KindEntry | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  const openNew = () => {
    setKind(null);
    setLabel("");
    setDescription("");
    setOpen(true);
  };

  const openEdit = (target: KindEntry) => {
    setKind(target);
    setLabel(target.label);
    setDescription(target.description ?? "");
    setOpen(true);
  };

  const close = () => setOpen(false);

  return { open, kind, label, description, openNew, openEdit, close, setLabel, setDescription };
}
