import { useQuery } from "@tanstack/react-query";
import { analyticsService, getAnalyticsInsights } from "@/services/analytics.service";

export const useAnalyticsOverview = () => {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsService.getOverview(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAnalyticsStreaks = () => {
  return useQuery({
    queryKey: ["analytics", "streaks"],
    queryFn: () => analyticsService.getStreaks(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAnalyticsProductivity = () => {
  return useQuery({
    queryKey: ["analytics", "productivity"],
    queryFn: () => analyticsService.getProductivity(),
    staleTime: 5 * 60 * 1000,
  });
};


export function useAnalyticsInsights() {
  return useQuery({
    queryKey: ["analytics", "insights"],
    queryFn: getAnalyticsInsights,
    staleTime: 5 * 60 * 1000,
  });
}
