"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/useTasks";
import { CheckCircle2, Circle, Clock, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function MyOpenTasks() {
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks();

  if (isLoading) {
    return (
      <div className="bg-[#121216] border border-white/5 rounded-2xl p-5 h-64 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const openTasks = tasks?.filter(t => t.status !== "completed").slice(0, 5) || [];

  return (
    <div className="bg-[#121216] border border-white/5 rounded-2xl p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-white tracking-tight">My Open Tasks</h3>
          <p className="text-xs text-white/40 mt-0.5">Tasks assigned to you</p>
        </div>
        <button 
          onClick={() => router.push("/tasks")}
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center"
        >
          View All <ChevronRight size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
        {openTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm space-y-2">
            <CheckCircle2 size={32} className="opacity-20" />
            <p>You&apos;re all caught up!</p>
          </div>
        ) : (
          openTasks.map(task => (
            <div 
              key={task.id}
              onClick={() => router.push(`/tasks/${task.id}`)}
              className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <button className="mt-0.5 text-white/20 group-hover:text-primary transition-colors">
                <Circle size={16} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{task.title}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                    task.priority === 'urgent' || task.priority === 'high' ? 'bg-red-500/10 text-red-400' : 
                    task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {task.priority}
                  </span>
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-white/40">
                      <Clock size={10} />
                      {format(new Date(task.due_date), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
