"use client";

import React from "react";
import { ProjectAnalytics as AnalyticsType } from "@/services/project.service";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  GitCommit,
  GitPullRequest,
  HeartPulse,
  ListTodo,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

interface ProjectAnalyticsProps {
  analytics: AnalyticsType;
}

export function ProjectAnalytics({ analytics }: ProjectAnalyticsProps) {
  const healthLabel =
    analytics.health_status === "healthy"
      ? "Healthy"
      : analytics.health_status === "attention"
        ? "Needs attention"
        : "At risk";

  const healthClasses =
    analytics.health_status === "healthy"
      ? "text-green-400 bg-green-500/10 border-green-500/20"
      : analytics.health_status === "attention"
        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
        : "text-red-400 bg-red-500/10 border-red-500/20";

  const cards = [
    {
      title: "Total Tasks",
      value: analytics.total_tasks,
      icon: <ListTodo size={20} className="text-blue-400" />,
      bg: "bg-blue-500/10",
    },
    {
      title: "Completed",
      value: analytics.completed_tasks,
      icon: <CheckCircle2 size={20} className="text-green-400" />,
      bg: "bg-green-500/10",
    },
    {
      title: "Pending",
      value: analytics.pending_tasks,
      icon: <Clock size={20} className="text-yellow-400" />,
      bg: "bg-yellow-500/10",
    },
    {
      title: "Overdue",
      value: analytics.overdue_tasks,
      icon: <AlertCircle size={20} className="text-red-400" />,
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${card.bg}`}>
              {card.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-white/40">{card.title}</p>
              <p className="text-2xl font-bold text-white/90">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-white/5 bg-gradient-to-br from-[#121216] to-[#0c0c0e] p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-white/80">Project completion</p>
              <p className="text-xs text-white/40 mt-1">Based on completed tasks</p>
            </div>
            <span className="text-3xl font-extrabold text-white">
              {analytics.completion_percentage}%
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analytics.completion_percentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08 }}
          className="rounded-xl border border-white/5 bg-[#121216] p-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse size={18} className="text-white/50" />
              <p className="text-sm font-semibold text-white/80">Project health</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${healthClasses}`}>
              {healthLabel}
            </span>
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="text-4xl font-extrabold text-white">{analytics.health_score}</span>
            <span className="pb-1 text-sm text-white/30">/ 100</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/40">
            Score combines task completion, overdue work, repository activity, and project deadlines.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.16 }}
          className="rounded-xl border border-white/5 bg-[#121216] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-white/50" />
            <p className="text-sm font-semibold text-white/80">Development activity</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <GitCommit size={16} className="text-primary mb-2" />
              <p className="text-xl font-bold text-white">{analytics.github_commits}</p>
              <p className="text-[11px] text-white/35">Commits tracked</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <GitPullRequest size={16} className="text-violet-400 mb-2" />
              <p className="text-xl font-bold text-white">{analytics.github_pull_requests}</p>
              <p className="text-[11px] text-white/35">Pull requests</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-xl font-bold text-white">{analytics.github_activity_7d}</p>
              <p className="text-[11px] text-white/35">Events · 7 days</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-xl font-bold text-white">{analytics.github_activity_30d}</p>
              <p className="text-[11px] text-white/35">Events · 30 days</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/35">
            {analytics.last_github_activity_at
              ? `Last activity ${formatDistanceToNow(new Date(analytics.last_github_activity_at), { addSuffix: true })}`
              : "No GitHub activity recorded yet"}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
