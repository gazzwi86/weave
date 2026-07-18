import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterForm, type FilterFormField } from "../FilterForm";

const ENGINE_FIELD: FilterFormField = {
  id: "engine",
  label: "Engine",
  type: "select",
  value: "ce",
  onChange: vi.fn(),
  options: [{ value: "ce", label: "CE" }],
};
const CONTAINS_FIELD: FilterFormField = { id: "contains", label: "Contains", type: "text", value: "", onChange: vi.fn() };
const FROM_FIELD: FilterFormField = { id: "from", label: "From", type: "date", value: "2026-07-01", onChange: vi.fn() };
const FIELDS: FilterFormField[] = [ENGINE_FIELD, CONTAINS_FIELD, FROM_FIELD];

describe("FilterForm", () => {
  it("renders a labelled field per entry", () => {
    render(<FilterForm fields={FIELDS} onApply={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByLabelText("Engine")).toBeInTheDocument();
    expect(screen.getByLabelText("Contains")).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toBeInTheDocument();
  });

  it("calls a field's onChange when its input value changes", () => {
    const onChange = vi.fn();
    const fields = [{ ...CONTAINS_FIELD, onChange }];
    render(<FilterForm fields={fields} onApply={vi.fn()} onReset={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Contains"), { target: { value: "publish" } });
    expect(onChange).toHaveBeenCalledWith("publish");
  });

  it("applies flex:1 via the flex-1 class for a grow field, not an invalid width style", () => {
    const fields = [{ ...CONTAINS_FIELD, grow: true }];
    render(<FilterForm fields={fields} onApply={vi.fn()} onReset={vi.fn()} />);
    const group = screen.getByLabelText("Contains").parentElement;
    expect(group).toHaveClass("flex-1");
    expect(group).not.toHaveAttribute("style");
  });

  it("calls onApply and onReset from the actions row", () => {
    const onApply = vi.fn();
    const onReset = vi.fn();
    render(<FilterForm fields={FIELDS} onApply={onApply} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
