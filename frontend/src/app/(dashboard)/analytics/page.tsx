"use client";

import React from "react";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import { ProductivityChart } from "@/components/analytics/ProductivityChart";
import { ActivityHeatmap } from "@/components/analytics/ActivityHeatmap";
import { ProjectProgressChart } from "@/components/analytics/ProjectProgressChart";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { useAnalyticsInsights } from "@/hooks/useAnalytics";

export default function AnalyticsPage() {
  const { data: insightsData } = useAnalyticsInsights();
  const insights = insightsData?.insights ?? [];

  return (
    <div className="flex flex-col h-full space-y-6 overflow-y-auto custom-scrollbar pb-6 pr-2">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Analytics</h1>
        <p className="text-sm text-white/40 mt-1">Track your coding productivity, streaks, and project health.</p>
      </motion.div>

      {/* KPI Overview Grid */}
      <AnalyticsOverview />

      {insights.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/5 bg-[#121216] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Actionable insights</h2>
              <p className="text-xs text-white/35 mt-1">Signals detected from your tasks, deadlines, and GitHub activity.</p>
            </div>
            <AlertTriangle size={18} className="text-yellow-400/70" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((insight) => (
              <div key={insight.project_id + "-" + insight.type} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white/90">{insight.title}</p>
                    <p className="text-xs text-white/40 mt-1">{insight.project}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-white/35">{insight.severity}</span>
                </div>
                <p className="text-sm text-white/55 mt-3">{insight.message}</p>
                <p className="text-xs text-primary/80 mt-3 flex items-center gap-1"><ArrowRight size={12} /> {insight.action}</p>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProductivityChart />
        <ProjectProgressChart />
      </div>

      {/* Full Width Heatmap */}
      <div className="w-full">
        <ActivityHeatmap />
      </div>
    </div>
  );
}
