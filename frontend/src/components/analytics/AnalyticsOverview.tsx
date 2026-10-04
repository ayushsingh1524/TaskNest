"use client";

import React from "react";
import { useAnalyticsOverview } from "@/hooks/useAnalytics";
import { Activity, CheckCircle2, Flame, FolderGit2 } from "lucide-react";
import { motion } from "framer-motion";

export function AnalyticsOverview() {
  const { data, isLoading, isError } = useAnalyticsOverview();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-28 rounded-xl border border-white/5 flex items-center justify-center text-white/30 text-sm bg-white/[0.02]">
        Failed to load overview data.
      </div>
    );
  }

  const cards = [
    {
      title: "Tasks Completed",
      value: data.total_completed_tasks,
      icon: <CheckCircle2 size={24} className="text-green-400" />,
      bg: "bg-green-500/10",
      glow: "shadow-[0_0_20px_rgba(74,222,128,0.1)]"
    },
    {
      title: "Current Streak",
      value: `${data.current_streak_days} days`,
      icon: <Flame size={24} className="text-orange-400" />,
      bg: "bg-orange-500/10",
      glow: "shadow-[0_0_20px_rgba(251,146,60,0.1)]"
    },
    {
      title: "Activity · 30d",
      value: data.activity_events_30d,
      icon: <Activity size={24} className="text-blue-400" />,
      bg: "bg-blue-500/10",
      glow: "shadow-[0_0_20px_rgba(59,130,246,0.1)]"
    },
    {
      title: "Active Projects",
      value: data.active_projects,
      icon: <FolderGit2 size={24} className="text-purple-400" />,
      bg: "bg-purple-500/10",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.1)]"
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className={`flex flex-col justify-center rounded-2xl border border-white/5 bg-[#121216] p-5 relative overflow-hidden group hover:border-white/10 transition-all ${card.glow}`}
        >
          
          <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
            {card.icon}
          </div>
          <div>
            <p className="text-3xl font-bold text-white tracking-tight">{card.value}</p>
            <p className="text-sm font-medium text-white/40 mt-1">{card.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
