import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { githubService } from "@/services/github.service";
import { toast } from "sonner";

export const useGithubStatus = () => {
  return useQuery({
    queryKey: ["github", "status"],
    queryFn: () => githubService.getStatus(),
  });
};

export const useGithubStats = (enabled: boolean) => {
  return useQuery({
    queryKey: ["github", "stats"],
    queryFn: () => githubService.getStats(),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.id === 0 ? 2000 : false,
  });
};

export const useConnectGithub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => githubService.connect(token),
    onSuccess: () => {
      toast.success("Successfully connected to GitHub!");
      queryClient.invalidateQueries({ queryKey: ["github"] });
    },
    onError: () => {
      toast.error("Failed to connect to GitHub.");
    }
  });
};

export const useDisconnectGithub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => githubService.disconnect(),
    onSuccess: () => {
      toast.success("Disconnected from GitHub.");
      queryClient.invalidateQueries({ queryKey: ["github"] });
    },
    onError: () => {
      toast.error("Failed to disconnect from GitHub.");
    }
  });
};

export const useSyncGithub = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => githubService.sync(),
    onSuccess: () => {
      toast.info("Background sync started...");
      // Reset the stats in cache so the polling logic kicks in
      queryClient.setQueryData(["github", "stats"], (old) =>
        old && typeof old === "object" ? { ...old, id: 0 } : old
      );
      queryClient.invalidateQueries({ queryKey: ["github", "status"] });
    },
    onError: () => {
      toast.error("Failed to start sync.");
    }
  });
};
