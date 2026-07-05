"use client";

import dynamic from "next/dynamic";

// Cytoscape.js needs a real DOM/canvas -- must never run during SSR.
// ponytail: thin next/dynamic wrapper, no unit test -- real rendering is
// covered by the Playwright E2E spec against /explorer.
export const ExplorerCanvasLoader = dynamic(
  () => import("./explorer-canvas").then((mod) => mod.ExplorerCanvas),
  { ssr: false }
);
