import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectService, CreateProjectDTO, UpdateProjectDTO, Project } from "@/services/project.service";
import { toast } from "sonner";

export const useProjects = (skip = 0, limit = 100) => {
  return useQuery({
    queryKey: ["projects", skip, limit],
    queryFn: () => projectService.getProjects(skip, limit),
  });
};

export const useProjectDetail = (id: number) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => projectService.getProject(id),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectDTO) => projectService.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to create project");
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProjectDTO }) =>
      projectService.updateProject(id, data),
    onSuccess: (updatedProject, variables) => {
      // Optimistic cache update for list
      queryClient.setQueryData<Project[]>(["projects", 0, 100], (old) => {
        if (!old) return old;
        return old.map((p) => (p.id === updatedProject.id ? updatedProject : p));
      });
      // Invalidate detail cache
      queryClient.invalidateQueries({ queryKey: ["project", updatedProject.id] });
      toast.success("Project updated");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to update project");
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => projectService.deleteProject(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<Project[]>(["projects", 0, 100], (old) => {
        if (!old) return old;
        return old.filter((p) => p.id !== deletedId);
      });
      toast.success("Project deleted");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to delete project");
    },
  });
};

export const useLinkGithubRepo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, repoFullName }: { projectId: number; repoFullName: string }) =>
      projectService.linkGithubRepo(projectId, repoFullName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
      toast.success("GitHub repository linked successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to link repository");
    },
  });
};


export const useUnlinkGithubRepo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, repoId }: { projectId: number; repoId: number }) =>
      projectService.unlinkGithubRepo(projectId, repoId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
      toast.success("GitHub repository unlinked");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Failed to unlink repository");
    },
  });
};
