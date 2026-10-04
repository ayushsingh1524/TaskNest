import axiosInstance from "@/lib/axios";

export interface AnalyticsOverview {
  total_completed_tasks: number;
  active_projects: number;
  current_streak_days: number;
  activity_events_30d: number;
}

export interface HeatmapDay {
  date: string;
  commits: number;
  tasks_completed: number;
}

export interface StreakData {
  heatmap: HeatmapDay[];
}

export interface WeeklyChartData {
  day: string;
  date: string;
  github_events: number;
  tasks: number;
  total_events: number;
}

export interface ProjectStat {
  name: string;
  progress: number;
  total_tasks: number;
  overdue_tasks: number;
  github_activity_30d: number;
}

export interface ProductivityData {
  weekly_chart: WeeklyChartData[];
  project_stats: ProjectStat[];
}

class AnalyticsService {
  async getOverview(): Promise<AnalyticsOverview> {
    const response = await axiosInstance.get("/analytics/overview");
    return response.data;
  }

  async getStreaks(): Promise<StreakData> {
    const response = await axiosInstance.get("/analytics/streaks");
    return response.data;
  }

  async getProductivity(): Promise<ProductivityData> {
    const response = await axiosInstance.get("/analytics/productivity");
    return response.data;
  }
}

export const analyticsService = new AnalyticsService();
