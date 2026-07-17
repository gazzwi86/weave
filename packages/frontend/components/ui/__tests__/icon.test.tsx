import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon } from "../icon";

describe("Icon", () => {
  it("renders an svg, aria-hidden, sized from the size prop", () => {
    const { container } = render(<Icon name="x" size={18} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "18");
    expect(svg).toHaveAttribute("height", "18");
  });

  it("renders distinct path data per icon name", () => {
    const { container: a } = render(<Icon name="x" />);
    const { container: b } = render(<Icon name="check" />);
    expect(a.querySelector("svg")?.innerHTML).not.toBe(b.querySelector("svg")?.innerHTML);
  });
});
