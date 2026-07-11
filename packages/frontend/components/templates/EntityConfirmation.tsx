import { EntityRef } from "@/components/molecules/EntityRef";
import { Button } from "@/components/ui/button";

export interface EntityConfirmationProps {
  label: string;
  id: string;
  onClose: () => void;
}

/** AC-7: created-entity confirmation -- friendly label + mono-styled
 * short-id chip (`EntityRef`), never a raw IRI on its own. */
export function EntityConfirmation({ label, id, onClose }: EntityConfirmationProps) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <p className="text-[length:var(--text-body)] text-[var(--color-text-default)]">Created</p>
      <EntityRef label={label} id={id} />
      <Button type="button" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}
