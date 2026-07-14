import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrainingCard } from "../training-card";
import type { TrainingEntry } from "../../../../shared/onboarding/content/schema";

const placeholderEntry: TrainingEntry = {
  trainingId: "getting-started",
  titleKey: "onboarding.training.getting-started.title",
  descriptionKey: "onboarding.training.getting-started.description",
  category: "introduction",
};

const playableEntry: TrainingEntry = {
  ...placeholderEntry,
  trainingId: "explorer-basics",
  videoId: "abc123",
  durationSeconds: 90,
};

describe("TrainingCard (AC-012-03)", () => {
  it("shows the 'Video — coming soon' placeholder when there is no videoId", () => {
    render(<TrainingCard entry={placeholderEntry} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.queryByTestId("training-video")).not.toBeInTheDocument();
  });

  it("renders a native <video> against the CloudFront URL shape when a videoId exists", () => {
    render(<TrainingCard entry={playableEntry} />);
    const video = screen.getByTestId("training-video") as HTMLVideoElement;
    expect(video.querySelector("source")?.getAttribute("src")).toBe(
      "https://training-cdn.weave.app/onboarding/abc123/720p.mp4"
    );
  });

  it("falls back to the placeholder/error state on a playback error, never a broken player", () => {
    render(<TrainingCard entry={playableEntry} />);
    const video = screen.getByTestId("training-video");
    fireEvent.error(video);
    expect(screen.getByText(/couldn.t load this video/i)).toBeInTheDocument();
    expect(screen.queryByTestId("training-video")).not.toBeInTheDocument();
  });
});
