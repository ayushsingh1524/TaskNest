"use client";

import React, { useState } from "react";
import {
  ExternalLink,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Link2,
  Plus,
  Unlink,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  GithubActivity,
  ProjectGithubRepo,
} from "@/services/project.service";

interface ProjectGithubActivityProps {
  repos: ProjectGithubRepo[];
  activities: GithubActivity[];
  onAddRepo?: (repoFullName: string) => void;
  onRemoveRepo?: (repoId: number) => void;
  isLinking?: boolean;
  isUnlinking?: boolean;
}

export function ProjectGithubActivity({
  repos,
  activities,
  onAddRepo,
  onRemoveRepo,
  isLinking = false,
  isUnlinking = false,
}: ProjectGithubActivityProps) {
  const [newRepo, setNewRepo] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    const repoFullName = newRepo.trim();
    if (!repoFullName || !onAddRepo) return;
    onAddRepo(repoFullName);
    setNewRepo("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#121216] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <GitBranch size={16} className="text-white/40" />
            Linked Repositories
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding((value) => !value)}
            className="h-8 text-xs text-primary hover:bg-primary/10"
          >
            <Plus size={14} className="mr-1" /> Add Repo
          </Button>
        </div>

        {isAdding && (
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newRepo}
              onChange={(event) => setNewRepo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleAdd();
              }}
              placeholder="e.g. owner/repository"
              className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
            />
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isLinking || !newRepo.trim()}
              className="h-[34px]"
            >
              {isLinking ? "Linking..." : "Link"}
            </Button>
          </div>
        )}

        {repos.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">
            No repositories linked to this project yet.
          </div>
        ) : (
          <div className="space-y-2">
            {repos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5"
              >
                <div className="flex min-w-0 items-center gap-3 text-sm text-white/80">
                  <Link2 size={14} className="shrink-0 text-white/40" />
                  <span className="truncate">{repo.repo_full_name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://github.com/${repo.repo_full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${repo.repo_full_name} on GitHub`}
                    className="p-2 text-white/40 hover:text-white transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                  {onRemoveRepo && (
                    <button
                      type="button"
                      disabled={isUnlinking}
                      onClick={() => {
                        if (confirm(`Unlink ${repo.repo_full_name} from this project?`)) {
                          onRemoveRepo(repo.id);
                        }
                      }}
                      className="p-2 text-white/30 hover:text-red-400 disabled:opacity-40 transition-colors"
                      aria-label={`Unlink ${repo.repo_full_name}`}
                    >
                      <Unlink size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <GitCommit size={16} className="text-white/40" />
          Recent Development Activity
        </h3>

        {activities.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl bg-[#121216]">
            <p className="text-white/40 text-sm">No GitHub activity recorded yet.</p>
          </div>
        ) : (
          <div className="relative pl-4 space-y-5 before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-white/10">
            {activities.slice(0, 12).map((activity) => {
              const isPullRequest = activity.activity_type === "pull_request";
              return (
                <div key={activity.id} className="relative flex items-start gap-4">
                  <div className="absolute -left-[10px] top-4 h-3 w-3 rounded-full border-2 border-[#0a0a0c] bg-primary shadow-[0_0_0_4px_#0a0a0c]" />
                  <div className="flex-1 bg-[#121216] border border-white/5 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isPullRequest ? (
                            <GitPullRequest size={14} className="shrink-0 text-violet-400" />
                          ) : (
                            <GitCommit size={14} className="shrink-0 text-primary" />
                          )}
                          <p className="truncate text-sm text-white/90 font-medium">
                            {activity.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/40">
                          <span className="text-primary/80">{activity.ref_id}</span>
                          <span>•</span>
                          <span>{activity.author}</span>
                        </div>
                      </div>
                      <span className="text-xs text-white/30 whitespace-nowrap">
                        {format(new Date(activity.timestamp), "MMM d, HH:mm")}
                      </span>
                    </div>
                    {activity.url && (
                      <a
                        href={activity.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-xs text-white/35 hover:text-primary transition-colors"
                      >
                        View on GitHub <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
