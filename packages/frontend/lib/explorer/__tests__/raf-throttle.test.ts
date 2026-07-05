import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rafThrottle } from "../raf-throttle";

describe("rafThrottle", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collapses bursty calls within one animation frame into a single invocation", () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);

    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn).not.toHaveBeenCalled();

    frames[0]?.(0);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("schedules a fresh frame for calls made after the previous frame ran", () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);

    throttled(1);
    frames[0]?.(0);
    throttled(2);

    expect(frames).toHaveLength(2);
    frames[1]?.(0);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });
});
