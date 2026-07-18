import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarMenu } from "../avatar-menu";

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: /account menu/i }));
}

describe("AvatarMenu", () => {
  // V5: refit-mock.html's "Operator console — provision companies" entry
  // is gated by the same isPlatformOperator predicate as the /operator
  // route itself (lib/auth/session-claims.ts), so a platform operator sees
  // the link and a regular member never does.
  it("shows the Operator console link for a platform operator role", () => {
    render(<AvatarMenu userName="Priya Shah" role="admin" />);
    openMenu();

    expect(screen.getByRole("link", { name: /operator console/i })).toHaveAttribute("href", "/operator");
  });

  it("hides the Operator console link for a non-privileged role", () => {
    render(<AvatarMenu userName="Ada Lovelace" role="author" />);
    openMenu();

    expect(screen.queryByRole("link", { name: /operator console/i })).not.toBeInTheDocument();
  });

  it("hides the Operator console link when role is unresolved", () => {
    render(<AvatarMenu userName="Ada Lovelace" role={null} />);
    openMenu();

    expect(screen.queryByRole("link", { name: /operator console/i })).not.toBeInTheDocument();
  });
});
