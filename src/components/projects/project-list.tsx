"use client";

import { useState, useCallback } from "react";
import { FolderKanban, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./project-card";
import { ProjectFormSheet } from "./project-form-sheet";
import { DiscoverWorkspaceDialog } from "@/components/workspace/discover-workspace-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeading } from "@/components/shared/section-heading";

interface Project {
  id: string;
  name: string;
  description: string | null;
  workingDirectory: string | null;
  customerId: string | null;
  status: string;
  taskCount: number;
  docCount: number;
}

export function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [sheetProject, setSheetProject] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const totalTasks = projects.reduce((sum, project) => sum + project.taskCount, 0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (res.ok) setProjects(await res.json());
  }, []);

  function handleCreate() {
    setSheetMode("create");
    setSheetProject(null);
    setSheetOpen(true);
  }

  function handleEdit(id: string, _trigger: HTMLElement | null) {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setSheetMode("edit");
      setSheetProject(project);
      setSheetOpen(true);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setDiscoverOpen(true)}>
          <FolderSearch className="h-4 w-4 mr-1.5" />
          Discover Workspace
        </Button>
        <Button onClick={handleCreate}>
          <FolderKanban className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Total Projects
          </p>
          <p className="mt-3 text-3xl font-semibold">{projects.length}</p>
        </div>
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Active
          </p>
          <p className="mt-3 text-3xl font-semibold">{activeProjects}</p>
        </div>
        <div className="surface-control rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Linked Tasks
          </p>
          <p className="mt-3 text-3xl font-semibold">{totalTasks}</p>
        </div>
      </div>

      <section className="surface-panel elevation-1 rounded-xl p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <SectionHeading className="mb-0">All Projects</SectionHeading>
          <p className="text-xs text-muted-foreground">{projects.length} visible</p>
        </div>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            heading="No projects yet"
            description="Create your first project or discover existing workspaces."
            action={
              <Button variant="outline" onClick={() => setDiscoverOpen(true)}>
                <FolderSearch className="h-4 w-4 mr-1.5" />
                Discover Workspace
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </section>

      <ProjectFormSheet
        mode={sheetMode}
        project={sheetProject}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={refresh}
      />

      <DiscoverWorkspaceDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        onComplete={refresh}
      />
    </div>
  );
}
