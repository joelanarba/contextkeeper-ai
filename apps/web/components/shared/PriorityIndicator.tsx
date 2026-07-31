"use client";

import { cn } from "@/lib/utils";

export function PriorityIndicator({ priority }: { priority: string }) {
  if (priority === 'LOW') return null;

  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
      priority === 'HIGH' ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50"
    )}>
      {priority}
    </span>
  );
}
