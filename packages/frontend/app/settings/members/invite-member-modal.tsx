"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalFormPage } from "@/components/templates/ModalFormPage";
import { CANONICAL_ROLES } from "./roles";

export interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  inviting: boolean;
  inviteError: string | null;
  onInvite: (email: string, role: string) => Promise<boolean>;
}

interface InviteFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  fieldError: string | null;
  inviteError: string | null;
}

function InviteFields({ email, onEmailChange, role, onRoleChange, fieldError, inviteError }: InviteFieldsProps) {
  return (
    <>
      <Input
        aria-label="Email"
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
      />
      <select
        aria-label="Role"
        data-testid="invite-role-select"
        value={role}
        onChange={(e) => onRoleChange(e.target.value)}
        className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      >
        {CANONICAL_ROLES.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.label}
          </option>
        ))}
      </select>

      {fieldError && (
        <p data-testid="invite-field-error" role="alert" className="text-[var(--color-danger)]">
          {fieldError}
        </p>
      )}
      {inviteError && (
        <p data-testid="invite-error" className="text-[var(--color-text-muted)]">
          {inviteError}
        </p>
      )}
    </>
  );
}

/** refit-mock.html `#sub-set-members`'s "Invite member" button opens this --
 * the mock has no modal markup of its own for it (button-only), so this
 * composes `ModalFormPage` (a `ModalShell`-based template) the same way
 * `FormDrawerPage` composes `GlassPanel`: title + fields + Cancel/primary
 * actions. */
export function InviteMemberModal({ open, onClose, inviting, inviteError, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(CANONICAL_ROLES[0]?.slug ?? "viewer");
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!email.trim()) {
      setFieldError("Email is required.");
      return;
    }
    setFieldError(null);
    if (await onInvite(email, role)) {
      setEmail("");
      onClose();
    }
  }

  return (
    <ModalFormPage
      open={open}
      onClose={onClose}
      title="Invite member"
      onSubmit={handleSubmit}
      fields={
        <InviteFields
          email={email}
          onEmailChange={setEmail}
          role={role}
          onRoleChange={setRole}
          fieldError={fieldError}
          inviteError={inviteError}
        />
      }
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={inviting}>
            Invite
          </Button>
        </>
      }
    />
  );
}
