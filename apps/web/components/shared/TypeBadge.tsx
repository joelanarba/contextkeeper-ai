"use client";

import { cn } from "@/lib/utils";
import type { Item } from "@contextkeeper/core";
import { CheckSquare, Lightbulb, StickyNote, Calendar, Folder } from "lucide-react";

export function TypeBadge({ type }: { type: Item['type'] }) {
  const config = {
    TASK: { icon: CheckSquare, color: "text-blue-600 bg-blue-50 border-blue-200" },
    IDEA: { icon: Lightbulb, color: "text-amber-600 bg-amber-50 border-amber-200" },
    NOTE: { icon: StickyNote, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    FOLLOW_UP: { icon: Calendar, color: "text-purple-600 bg-purple-50 border-purple-200" },
    PROJECT: { icon: Folder, color: "text-zinc-600 bg-zinc-100 border-zinc-200" },
  };

  const { icon: Icon, color } = config[type] || config.NOTE;

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
      color
    )}>
      <Icon className="w-3 h-3" />
      <span className="capitalize">{type.replace('_', ' ').toLowerCase()}</span>
    </span>
  );
}
