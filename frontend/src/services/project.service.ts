import axiosInstance from "@/lib/axios";
interface User {
  id: number;
  username: string;
  email?: string;
  avatar?: string | null;
}
import { Task } from "./task.service";

export interface Project {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  status: "active" | "completed" | "on_hold";
  deadline?: string;
  created_at: string;
  updated_at: string;
  owner?: User;
}

export interface ProjectAnalytics {
  total_tasks: number;
  completed_tasks: number;
  completion_percentage: number;
  overdue_tasks: number;
  pending_tasks: number;
  github_commits: number;
  github_pull_requests: number;
  github_activity_7d: number;
  github_activity_30d: number;
  last_github_activity_at: string | null;
  health_score: number;
  health_status: "healthy" | "attention" | "at_risk";
}

export interface ProjectGithubRepo {
  id: number;
  project_id: number;
  repo_full_name: string;
  created_at: string;
}

export interface GithubActivity {
  id: number;
  project_id: number;
  activity_type: string;
  ref_id: string;
  title: string;
  author: string;
  url: string;
  timestamp: string;
}

export interface ProjectDetail extends Project {
  tasks: Task[];
  analytics: ProjectAnalytics;
  github_repos: ProjectGithubRepo[];
  github_activities: GithubActivity[];
}

export interface CreateProjectDTO {
  title: string;
  description?: string;
  status?: string;
  deadline?: string;
}

export interface UpdateProjectDTO {
  title?: string;
  description?: string;
  status?: string;
  deadline?: string;
}

class ProjectService {
  async getProjects(skip = 0, limit = 100): Promise<Project[]> {
    const response = await axiosInstance.get("/projects", {
      params: { skip, limit },
    });
    return response.data;
  }

  async getProject(id: number): Promise<ProjectDetail> {
    const response = await axiosInstance.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: CreateProjectDTO): Promise<Project> {
    const response = await axiosInstance.post("/projects", data);
    return response.data;
  }

  async updateProject(id: number, data: UpdateProjectDTO): Promise<Project> {
    const response = await axiosInstance.patch(`/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: number): Promise<Project> {
    const response = await axiosInstance.delete(`/projects/${id}`);
    return response.data;
  }

  async linkGithubRepo(projectId: number, repoFullName: string): Promise<ProjectGithubRepo> {
    const response = await axiosInstance.post(`/projects/${projectId}/github_repos`, {
      repo_full_name: repoFullName,
    });
    return response.data;
  }

  async unlinkGithubRepo(projectId: number, repoId: number): Promise<void> {
    await axiosInstance.delete(`/projects/${projectId}/github_repos/${repoId}`);
  }
}

export const projectService = new ProjectService();
