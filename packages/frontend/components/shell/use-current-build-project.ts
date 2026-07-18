"use client";

import { useEffect, useState } from "react";

export interface BuildProjectOption {
  projectIri: string;
  name: string;
}

const PROJECT_ID_IN_PATH = /^\/build\/projects\/([^/]+)/;

/** Project id segment of a Build-section pathname, or null off a
 * project-scoped route (e.g. `/build`, the Registry). */
function projectIdFromPath(pathname: string): string | null {
  return PROJECT_ID_IN_PATH.exec(pathname)?.[1] ?? null;
}

/** refit-mock.html buildSidebarHTML()/setProject(): the Build rail's
 * "Current project" switcher. Fetches the project list once (same
 * `GET /api/build/projects` contract `app/build/use-project-grid.ts` uses
 * for the Registry grid -- not imported directly, to keep the shared shell
 * layer decoupled from a single route's feature hook) and picks the
 * current project from the URL when on a project-scoped route, else the
 * first project in the list (mock's static default). */
export function useCurrentBuildProject(pathname: string): {
  projects: BuildProjectOption[];
  currentProjectIri: string | null;
  setCurrentProjectIri: (iri: string) => void;
} {
  const [projects, setProjects] = useState<BuildProjectOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/build/projects", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("project_list_failed");
        return res.json() as Promise<{ items: { project_iri: string; name: string }[] }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setProjects(data.items.map((item) => ({ projectIri: item.project_iri, name: item.name })));
      })
      .catch(() => {
        /* ponytail: switcher just stays empty on failure -- no retry UI,
         * the Registry grid already owns the load-error affordance. */
      });
    return () => controller.abort();
  }, []);

  // On a project-scoped route the URL is the source of truth (e.g.
  // clicking a Registry card) -- a manual dropdown pick only matters off
  // one (Registry itself), where there's no URL project id to defer to.
  // ponytail: a manual pick made while already on a project-scoped page
  // is ignored until the user navigates off it; the mock's in-memory
  // `currentProject` var has the same "picking doesn't navigate you"
  // quirk, so this is a faithful, not lazier, reading -- upgrade if a
  // "switch without leaving the page" flow is actually requested.
  const fromPath = projectIdFromPath(pathname);
  const currentProjectIri = fromPath
    ? decodeURIComponent(fromPath)
    : (selected ?? projects[0]?.projectIri ?? null);

  return { projects, currentProjectIri, setCurrentProjectIri: setSelected };
}
