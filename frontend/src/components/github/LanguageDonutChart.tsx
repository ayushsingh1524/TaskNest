"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { GithubStats } from "@/services/github.service";
import { motion } from "framer-motion";
import { Code2 } from "lucide-react";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md">
        <p className="font-semibold text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
          {data.name}: <span className="text-muted-foreground">{data.value}%</span>
        </p>
      </div>
    );
  }
  return null;
};

interface LanguageDonutChartProps {
  stats: GithubStats;
  isSyncing: boolean;
}

const COLORS = ["#3178c6", "#3572A5", "#dea584", "#00ADD8", "#e34c26", "#f1e05a", "#b07219"];

export function LanguageDonutChart({ stats, isSyncing }: LanguageDonutChartProps) {
  const chartData = !stats?.top_languages
    ? []
    : Object.entries(stats.top_languages)
        .map(([name, value], index) => ({
          name,
          value,
          color: COLORS[index % COLORS.length],
        }))
        .sort((a, b) => b.value - a.value);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-[350px] rounded-2xl border border-border bg-card p-6 shadow-lg relative theme-transition apple-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Most Used Languages</h2>
          <p className="text-sm text-muted-foreground mt-1">Based on repository analysis</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Code2 className="text-blue-400" size={20} />
        </div>
      </div>

      <div className="flex-1 w-full h-full flex items-center justify-center relative">
        {isSyncing || chartData.length === 0 ? (
          <div className="text-muted-foreground text-sm animate-pulse">Analyzing repositories...</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  animationDuration={1500}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{chartData.length}</p>
                <p className="text-xs text-muted-foreground">Languages</p>
              </div>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
