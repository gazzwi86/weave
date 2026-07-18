import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "../toast";

function Trigger({ message = "Saved" }: { message?: string }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast({ message })}>
      fire
    </button>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastProvider / useToast", () => {
  it("useToast throws outside a ToastProvider", () => {
    expect(() => renderHook(() => useToast())).toThrow(/ToastProvider/);
  });

  it("push shows the toast, and stacks a second push above the first", () => {
    render(
      <ToastProvider>
        <Trigger message="First" />
        <Trigger message="Second" />
      </ToastProvider>
    );

    const triggers = screen.getAllByRole("button", { name: "fire" });
    fireEvent.click(triggers[0]!);
    fireEvent.click(triggers[1]!);

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("auto-dismisses after 5.2s", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "fire" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5200 + 320);
    });

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("clicking Dismiss removes the toast after the exit transition", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "fire" }));

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByText("Saved")).toBeInTheDocument(); // still mid-exit-transition

    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
