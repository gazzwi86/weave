import { useState } from 'react';
import type { Project } from '../types';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '../hooks/queries';

interface Props {
  activeId: string;
  onSelect: (id: string) => void;
}

/** Top-bar dropdown to switch, create, and delete projects. */
export default function ProjectSwitcher({ activeId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

  const active = projects.find((p) => p.id === activeId);

  function handleRename(project: Project) {
    const name = window.prompt('Rename project', project.name);
    if (!name || name === project.name) return;
    updateProject.mutate({ id: project.id, body: { name } });
  }

  function handleCreate(seed: 'empty' | 'demo') {
    const name = window.prompt('Project name?');
    if (!name) return;
    createProject.mutate(
      { name, seed },
      { onSuccess: (p) => onSelect(p.id) },
    );
    setOpen(false);
  }

  function handleDelete(project: Project) {
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        if (project.id === activeId) {
          const next = projects.find((p) => p.id !== project.id);
          if (next) onSelect(next.id);
        }
      },
    });
  }

  return (
    <div className="switcher">
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {active ? active.name : 'Select project'} ▾
      </button>

      {open && (
        <div className="switcher-menu" role="menu">
          {projects.map((p) => (
            <div className="switcher-item" key={p.id}>
              <button
                className={`switcher-item grow ${p.id === activeId ? 'active' : ''}`}
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
              >
                <span className="grow">
                  <div className="name">
                    {p.name} {p.is_demo && <span className="chip">demo</span>}
                  </div>
                  <div className="meta">
                    {p.node_count} nodes · {p.edge_count} edges
                  </div>
                </span>
              </button>
              {!p.is_demo && (
                <>
                  <button
                    className="icon-btn"
                    title="Rename project"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => handleRename(p)}
                  >
                    ✎
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete project"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => handleDelete(p)}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}

          <div className="switcher-divider" />
          <button className="switcher-item" onClick={() => handleCreate('empty')}>
            ＋ New empty project
          </button>
          <button className="switcher-item" onClick={() => handleCreate('demo')}>
            ＋ New from demo
          </button>
        </div>
      )}
    </div>
  );
}
