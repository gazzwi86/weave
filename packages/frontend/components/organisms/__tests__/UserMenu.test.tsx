import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserMenu } from "../UserMenu";

describe("UserMenu", () => {
  it("renders the name, role, and a two-letter gradient avatar", () => {
    render(<UserMenu name="Ada Lovelace" role="admin" items={[]} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("renders each item with its icon and label", () => {
    render(
      <UserMenu
        name="Ada Lovelace"
        items={[
          { icon: "user", label: "Profile & preferences", href: "/settings" },
          { icon: "swap", label: "Switch workspace", href: "/settings/workspaces" },
        ]}
      />
    );
    const profile = screen.getByRole("link", { name: "Profile & preferences" });
    expect(profile).toHaveAttribute("href", "/settings");
    expect(profile.querySelector("svg")).toBeInTheDocument();
  });

  it("renders trailing content next to an item (e.g. a Theme pill)", () => {
    render(<UserMenu name="Ada" items={[{ icon: "moon", label: "Theme", trailing: <span>Dark</span> }]} />);
    expect(screen.getByText("Dark")).toBeInTheDocument();
  });

  it("renders a link item with the given href instead of a click handler", () => {
    const signOutHref = "/api/auth/signout";
    render(<UserMenu name="Ada" items={[{ icon: "logout", label: "Sign out", href: signOutHref }]} />);
    expect(screen.getByRole("link", { name: "Sign out" })).toHaveAttribute("href", signOutHref);
  });

  it("renders a separator before an item flagged separatorBefore", () => {
    const { container } = render(
      <UserMenu
        name="Ada"
        items={[
          { icon: "moon", label: "Theme" },
          { icon: "logout", label: "Sign out", href: "/api/auth/signout", separatorBefore: true },
        ]}
      />
    );
    expect(container.querySelectorAll("[data-menu-separator]")).toHaveLength(1);
  });
});
