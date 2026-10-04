"use client";

import React, { useMemo, useState } from "react";
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  SortableContext, 
  arrayMove, 
  sortableKeyboardCoordinates,
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { Task } from "@/services/task.service";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanTaskCard } from "./KanbanTaskCard";

type TaskStatus = "todo" | "in_progress" | "review" | "completed";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (taskId: number) => void;
  onTaskUpdate?: (taskId: number, newStatus: TaskStatus) => void;
}

const COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "In Review" },
  { id: "completed", title: "Completed" },
];

export function KanbanBoard({ tasks, onTaskClick, onTaskUpdate }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped = {
      todo: [] as Task[],
      in_progress: [] as Task[],
      review: [] as Task[],
      completed: [] as Task[],
    };
    
    tasks.forEach(task => {
      if (grouped[task.status as keyof typeof grouped]) {
        grouped[task.status as keyof typeof grouped].push(task);
      } else {
        grouped.todo.push(task); // fallback
      }
    });
    return grouped;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // 5px drag distance to activate, allows clicking
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as number;
    
    // Check if dropping over a column or another task
    const overId = over.id as string | number;
    let newStatus: TaskStatus | null = null;

    // If dropped over a column id
    if (COLUMNS.find(c => c.id === overId)) {
      newStatus = overId as TaskStatus;
    } else {
      // If dropped over another task
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) {
        newStatus = overTask.status as TaskStatus;
      }
    }

    if (newStatus && onTaskUpdate) {
      const activeTask = tasks.find(t => t.id === taskId);
      if (activeTask && activeTask.status !== newStatus) {
        onTaskUpdate(taskId, newStatus);
      }
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-4 h-full">
          {COLUMNS.map((column) => (
            <KanbanColumn 
              key={column.id} 
              column={column} 
              tasks={tasksByStatus[column.id as keyof typeof tasksByStatus]} 
              onTaskClick={onTaskClick}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rotate-2 scale-105 cursor-grabbing">
            <KanbanTaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
