import { useRef, type ChangeEvent } from "react";
import type { StudioProject } from "../types/studio";

type ProjectDashboardProps = {
  projects: StudioProject[];
  query: string;
  onQueryChange: (query: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onOpen: (files: FileList | null) => void;
  onSelect: (project: StudioProject) => void;
  onExport: (project: StudioProject) => void;
  onDelete: (project: StudioProject) => void;
  onRename: (project: StudioProject, name: string) => void;
};

export function ProjectDashboard({ projects, query, onQueryChange, onClose, onCreate, onOpen, onSelect, onExport, onDelete, onRename }: ProjectDashboardProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const visibleProjects = projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase()));
  const openProject = () => {
    const input = importRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.click();
  };
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    onOpen(event.target.files);
    event.target.value = "";
  };

  return <div className="dashboard-overlay"><div className="dashboard-panel"><header><div><span className="dashboard-mark">L</span><span>LOCAL AI STUDIO</span></div><button title="Close projects" onClick={onClose}>×</button></header><div className="dashboard-content"><p className="dashboard-eyebrow">YOUR WORKSPACE</p><h1>Projects</h1><p className="dashboard-subtitle">Each project keeps its own files and workspace.</p><div className="dashboard-actions"><button onClick={onCreate}>＋ New project</button><button onClick={openProject}>↗ Open project</button><input ref={importRef} type="file" multiple hidden onChange={selectFiles} /></div><div className="dashboard-search-wrap"><span>⌕</span><input className="dashboard-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search projects" /></div><div className="recent-heading"><span>PROJECTS</span><span>FILES</span></div><div className="project-list">{visibleProjects.map((project) => <div className={`project-list-row ${project.id === "demo-project" ? "starter-project" : ""}`} key={project.id}><button className="recent-project" onClick={() => onSelect(project)}><span className="recent-project-icon">◫</span><span><strong>{project.name}</strong><small>{project.starter ? "Starter project" : "Local project"}</small></span><span>{project.files.filter((file) => !file.path.endsWith("/.keep")).length} files</span><b>›</b></button><div className="project-row-actions"><button title="Download project as ZIP" onClick={() => onExport(project)}>↓</button><button title="Rename project" onClick={() => { const name = window.prompt("Rename project", project.name); if (name?.trim()) onRename(project, name.trim()); }}>···</button>{!project.starter && <button title="Delete project" onClick={() => onDelete(project)}>×</button>}</div></div>)}{visibleProjects.length === 0 && <p className="no-projects">No projects match “{query}”.</p>}</div><div className="dashboard-foot"><span>{projects.length} project{projects.length === 1 ? "" : "s"} on this device</span><button onClick={onClose}>Open workspace →</button></div></div></div></div>;
}
