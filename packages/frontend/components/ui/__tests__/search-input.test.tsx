import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "../search-input";

describe("SearchInput", () => {
  it("renders a search textbox with the given placeholder", () => {
    render(<SearchInput placeholder="Search entities" value="" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: /search entities/i })).toBeInTheDocument();
  });

  it("calls onChange with the new value", () => {
    const onChange = vi.fn();
    render(<SearchInput placeholder="Search" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    expect(onChange).toHaveBeenCalledWith("abc");
  });

  it("shows the current value", () => {
    render(<SearchInput placeholder="Search" value="hello" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("hello");
  });
});
