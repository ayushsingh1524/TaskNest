"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectDetail, useDeleteProject, useLinkGithubRepo, useUnlinkGithubRepo } from "@/hooks/useProjects";
import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { ProjectGithubActivity } from "@/components/projects/ProjectGithubActivity";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft, Edit3, Trash2, Calendar, Loader2, LayoutList, KanbanSquare } from "lucide-react";
import { motion } from "framer-motion";
import { TaskList } from "@/components/tasks/TaskList";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { useUpdateTask } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { FileText } from "lucide-react";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = Number(params.id);

  const { data: project, isLoading, isError } = useProjectDetail(projectId);
  const deleteProject = useDeleteProject();
  const updateTask = useUpdateTask();
  const linkRepo = useLinkGithubRepo();
  const unlinkRepo = useUnlinkGithubRepo();
  const { data: projectNotes } = useNotes(undefined, projectId);

  const [taskView, setTaskView] = useState<"list" | "kanban">("list");

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this project? Tasks will lose their project association.")) {
      deleteProject.mutate(projectId, {
        onSuccess: () => {
          router.push("/projects");
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="text-center text-red-400 mt-10">
        Project not found.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "on_hold":
        return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
      default:
        return "bg-white/10 text-white/60 border-white/10";
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Top Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <button 
          onClick={() => router.push("/projects")}
          className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back to Projects
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">{project.title}</h1>
              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-medium uppercase tracking-wider ${getStatusColor(project.status)}`}>
                {project.status.replace("_", " ")}
              </span>
            </div>
            {project.description && (
              <p className="text-white/60 mt-3 max-w-3xl leading-relaxed">{project.description}</p>
            )}
            
            <div className="flex items-center gap-6 mt-4 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>Created {format(new Date(project.created_at), "MMM d, yyyy")}</span>
              </div>
              {project.deadline && (
                <div className="flex items-center gap-2 text-primary/80">
                  <Calendar size={14} />
                  <span>Due {format(new Date(project.deadline), "MMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
              <Edit3 size={16} /> Edit
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDelete}
              disabled={deleteProject.isPending}
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 gap-2"
            >
              <Trash2 size={16} /> Delete
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="border-b border-white/5 pb-2">
        <h2 className="text-lg font-semibold text-white">Project Overview</h2>
      </div>

      {/* Analytics Dashboard */}
      <ProjectAnalytics analytics={project.analytics} />

      {/* GitHub Integration */}
      <div className="mt-8">
        <ProjectGithubActivity
          repos={project.github_repos || []}
          activities={project.github_activities || []}
          onAddRepo={(repoFullName) => linkRepo.mutate({ projectId, repoFullName })}
          onRemoveRepo={(repoId) => unlinkRepo.mutate({ projectId, repoId })}
          isLinking={linkRepo.isPending}
          isUnlinking={unlinkRepo.isPending}
        />
      </div>

      {/* Project Tasks */}
      <div className="mt-8 space-y-4 flex-1 flex flex-col min-h-[400px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Project Tasks</h2>
          
          <div className="flex items-center bg-white/5 p-1 rounded-lg">
            <button
              onClick={() => setTaskView("list")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                taskView === "list" ? "bg-[#1e1e24] text-white shadow-sm" : "text-white/40 hover:text-white"
              }`}
            >
              <LayoutList size={14} /> List
            </button>
            <button
              onClick={() => setTaskView("kanban")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                taskView === "kanban" ? "bg-[#1e1e24] text-white shadow-sm" : "text-white/40 hover:text-white"
              }`}
            >
              <KanbanSquare size={14} /> Kanban
            </button>
          </div>
        </div>

        <div className="flex-1 rounded-xl bg-transparent">
          {taskView === "list" ? (
            <TaskList 
              tasks={project.tasks} 
              onTaskClick={(id) => router.push(`/tasks/${id}`)} 
            />
          ) : (
            <KanbanBoard 
              tasks={project.tasks} 
              onTaskClick={(id) => router.push(`/tasks/${id}`)}
              onTaskUpdate={(taskId, newStatus: "todo" | "in_progress" | "review" | "completed") => {
                updateTask.mutate({ id: taskId, data: { status: newStatus } });
              }}
            />
          )}
        </div>
      </div>

      {/* Project Notes Section */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-lg font-semibold text-white">Project Notes</h2>
          <Button onClick={() => router.push("/notes")} variant="ghost" className="text-primary hover:text-primary hover:bg-primary/10">
            Open Notebook
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!projectNotes || projectNotes.length === 0 ? (
            <div className="col-span-full p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
              <FileText className="mx-auto mb-2 text-white/20" size={24} />
              <p className="text-white/40 text-sm">No notes attached to this project yet.</p>
              <Button 
                variant="link" 
                onClick={() => router.push("/notes")}
                className="text-primary mt-2 h-auto p-0"
              >
                Create a note
              </Button>
            </div>
          ) : (
            projectNotes.map(note => (
              <div 
                key={note.id} 
                onClick={() => router.push("/notes")}
                className="p-4 rounded-xl border border-white/5 bg-[#121216] hover:bg-white/[0.02] transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-white/90 group-hover:text-primary transition-colors line-clamp-1">{note.title}</h3>
                  <FileText size={14} className="text-white/20" />
                </div>
                <p className="mt-2 text-xs text-white/40 line-clamp-2">
                  {note.markdown_content || "Empty note"}
                </p>
                <div className="mt-3 text-[10px] text-white/30 uppercase font-semibold">
                  {format(new Date(note.updated_at), "MMM d, yyyy")}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
