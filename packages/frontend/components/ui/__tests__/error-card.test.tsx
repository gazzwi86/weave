import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorCard } from "../error-card";

describe("ErrorCard", () => {
  it("renders as an alert with the title and body", () => {
    render(<ErrorCard title="Query timed out after 10 s" body="The store may be busy. Try again." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Query timed out after 10 s");
    expect(alert).toHaveTextContent("The store may be busy. Try again.");
  });

  it("omits the Retry button when onRetry is not given", () => {
    render(<ErrorCard title="Failed" body="No retry here." />);
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("calls onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorCard title="Failed" body="Try again." onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
