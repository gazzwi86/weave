"use client";

import type { ReactNode } from "react";

import { Button } from "../ui/button";
import type { IconName } from "../ui/icon";
import { Drawer } from "./Drawer";

export interface EntityEditDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  /** Present only for an existing entity -- absence renders no Delete affordance.
   * The drawer only fires the callback; opening the ConfirmDialog is the caller's job. */
  onDelete?: () => void;
  icon: IconName;
  tone: string;
  title: ReactNode;
  label: string;
  onLabelChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  /** Kind-specific fields (colour swatches, SHACL shape, etc.) -- caller's content. */
  kindFields?: ReactNode;
  /** RelationshipsEditor (or equivalent) -- rendered under a "Relationships" label. */
  relationships?: ReactNode;
}

const FIELD_CLASS = "flex flex-col gap-[var(--space-1)]";
const LABEL_CLASS = "text-[length:var(--text-caption)] font-[var(--font-weight-medium)] text-[var(--color-text-muted)]";
const INPUT_CLASS =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] " +
  "px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] " +
  "focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

type FieldsProps = Pick<
  EntityEditDrawerProps,
  "label" | "onLabelChange" | "description" | "onDescriptionChange" | "kindFields" | "relationships"
>;

function EntityEditFields({
  label,
  onLabelChange,
  description,
  onDescriptionChange,
  kindFields,
  relationships,
}: FieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className={FIELD_CLASS}>
        <label htmlFor="entity-edit-label" className={LABEL_CLASS}>
          Label
        </label>
        <input
          id="entity-edit-label"
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div className={FIELD_CLASS}>
        <label htmlFor="entity-edit-description" className={LABEL_CLASS}>
          Description
        </label>
        <textarea
          id="entity-edit-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          className={INPUT_CLASS}
        />
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          Shown in tooltips, the canvas legend and AI grounding.
        </span>
      </div>
      {kindFields}
      {relationships ? (
        <div className={FIELD_CLASS}>
          <span className={LABEL_CLASS}>Relationships</span>
          {relationships}
        </div>
      ) : null}
    </div>
  );
}

function EntityEditFooter({ onClose, onSave }: Pick<EntityEditDrawerProps, "onClose" | "onSave">) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" onClick={onSave}>
        Save changes
      </Button>
    </>
  );
}

/** refit-mock.html `#edit-drawer` -- the shared entity/kind edit panel:
 * label + description are universal, kindFields/relationships are optional
 * caller-supplied slots (a kind edit has swatches+SHACL, an instance edit
 * has RelationshipsEditor, a brand-new entity has neither). Composes Drawer
 * for the chrome; fully controlled, no internal draft state. */
export function EntityEditDrawer(props: EntityEditDrawerProps) {
  const { open, onClose, onSave, onDelete, icon, tone, title } = props;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      icon={icon}
      tone={tone}
      title={title}
      size="default"
      dangerSlot={
        onDelete ? (
          <Button variant="ghost" className="text-[var(--color-danger)]" onClick={onDelete}>
            Delete
          </Button>
        ) : undefined
      }
      footer={<EntityEditFooter onClose={onClose} onSave={onSave} />}
    >
      <EntityEditFields {...props} />
    </Drawer>
  );
}
