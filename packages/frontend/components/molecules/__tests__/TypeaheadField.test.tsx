import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TypeaheadField, type TypeaheadOption } from "../TypeaheadField";

const OPTIONS: TypeaheadOption[] = [
  { value: "a", label: "Alpha", sub: "urn:weave:alpha" },
  { value: "b", label: "Beta", sub: "urn:weave:beta" },
];

function Controlled({
  onPick,
  options = OPTIONS,
}: {
  onPick: (option: TypeaheadOption) => void;
  options?: TypeaheadOption[];
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <TypeaheadField
      id="ta"
      label="Search"
      value={value}
      onValueChange={setValue}
      options={options}
      open={open}
      onOpenChange={setOpen}
      onPick={(option) => {
        setValue(option.label);
        onPick(option);
      }}
    />
  );
}

describe("TypeaheadField", () => {
  it("opens on type", () => {
    render(<Controlled onPick={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Al" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("picks an option on click", () => {
    const onPick = vi.fn();
    render(<Controlled onPick={onPick} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Al" } });
    fireEvent.mouseDown(screen.getByText("Alpha"));
    expect(onPick).toHaveBeenCalledWith(OPTIONS[0]);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <Controlled onPick={vi.fn()} />
        <button type="button">outside</button>
      </div>
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Al" } });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("navigates with arrow keys and picks with enter", () => {
    const onPick = vi.fn();
    render(<Controlled onPick={onPick} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "e" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith(OPTIONS[1]);
  });

  it("closes on escape", () => {
    render(<Controlled onPick={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Al" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("TypeaheadField listbox height", () => {
  it("caps the listbox height and scrolls instead of growing unbounded for a long option list", () => {
    const manyOptions: TypeaheadOption[] = Array.from({ length: 40 }, (_, index) => ({
      value: `opt-${index}`,
      label: `Option ${index}`,
    }));
    render(<Controlled onPick={vi.fn()} options={manyOptions} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Option" } });
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveClass("max-h-[var(--size-picker-list-max)]");
    expect(listbox).toHaveClass("overflow-y-auto");
  });
});
