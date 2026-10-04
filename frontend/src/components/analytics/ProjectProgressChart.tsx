"use client";

import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import { useAnalyticsProductivity } from "@/hooks/useAnalytics";
import { Loader2, FolderGit2 } from "lucide-react";
import { motion } from "framer-motion";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0c]/90 p-4 shadow-2xl backdrop-blur-md">
        <p className="mb-2 font-semibold text-white/90">{data.name}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-purple-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            {data.progress}% Completed
          </p>
          <p className="text-sm font-medium text-white/60 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white/20" />
            {data.total_tasks} Total Tasks
          </p>
          <p className="text-sm font-medium text-red-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            {data.overdue_tasks} Overdue
          </p>
          <p className="text-sm font-medium text-blue-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            {data.github_activity_30d} GitHub Events · 30d
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function ProjectProgressChart() {
  const { data, isLoading, isError } = useAnalyticsProductivity();

  if (isLoading) {
    return (
      <div className="h-[400px] rounded-2xl border border-white/5 bg-[#121216] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-[400px] rounded-2xl border border-white/5 bg-[#121216] flex items-center justify-center text-white/30 text-sm">
        Failed to load project stats.
      </div>
    );
  }

  const chartData = data.project_stats || [];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-[400px] rounded-2xl border border-white/5 bg-[#121216] p-6 shadow-lg"
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white/90">Project Health</h2>
          <p className="text-sm text-white/40 mt-1">Real completion, overdue work, and recent development activity</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <FolderGit2 className="text-purple-400" size={20} />
        </div>
      </div>

      <div className="flex-1 w-full h-full">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/30 text-sm">
            No active projects to display.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" horizontal={false} />
              <XAxis 
                type="number"
                domain={[0, 100]}
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#ffffff60", fontSize: 12 }} 
              />
              <YAxis 
                dataKey="name" 
                type="category"
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "#ffffff90", fontSize: 12 }} 
                width={120}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff05" }} />
              <Bar 
                dataKey="progress" 
                barSize={16} 
                radius={[0, 4, 4, 0]} 
                animationDuration={1500}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.progress === 100 ? "#4ade80" : "#a855f7"} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
