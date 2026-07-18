import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoMark } from "../logo-mark";

describe("LogoMark", () => {
  it("scopes gradient ids per instance so two mounted marks don't collide", () => {
    const { container } = render(
      <div>
        <LogoMark />
        <LogoMark />
      </div>
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sizes the svg from the size prop", () => {
    const { container } = render(<LogoMark size={40} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "40");
    expect(svg).toHaveAttribute("height", "40");
  });
});
