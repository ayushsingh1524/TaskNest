"use client";

import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAnalyticsProductivity } from "@/hooks/useAnalytics";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#0a0a0c]/90 p-4 shadow-2xl backdrop-blur-md">
        <p className="mb-2 font-semibold text-white/90">{label}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            {payload[0].value} GitHub Events
          </p>
          <p className="text-sm font-medium text-green-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {payload[1].value} Tasks Completed
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function ProductivityChart() {
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
        Failed to load productivity chart.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col h-[400px] rounded-2xl border border-white/5 bg-[#121216] p-6 shadow-lg relative overflow-hidden group"
    >
      <div className="mb-6 flex items-center justify-between z-10">
        <div>
          <h2 className="text-lg font-bold text-white/90">Weekly Productivity</h2>
          <p className="text-sm text-white/40 mt-1">GitHub activity vs completed tasks · last 7 days</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-white/60">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            GitHub
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            Tasks
          </div>
        </div>
      </div>

      <div className="flex-1 w-full h-full z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data.weekly_chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "#ffffff60", fontSize: 12 }} 
              dy={10}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "#ffffff60", fontSize: 12 }} 
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              axisLine={false} 
              tickLine={false} 
              tick={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#ffffff05" }} />
            
            <Area 
              yAxisId="left"
              type="monotone" 
              dataKey="github_events" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorHours)" 
              animationDuration={1500}
            />
            <Bar 
              yAxisId="right"
              dataKey="tasks" 
              barSize={12} 
              fill="#4ade80" 
              radius={[4, 4, 4, 4]} 
              animationDuration={1500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-primary/5 blur-[100px] rounded-full pointer-events-none transition-opacity duration-1000 opacity-50 group-hover:opacity-100" />
    </motion.div>
  );
}
