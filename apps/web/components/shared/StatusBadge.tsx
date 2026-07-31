"use client";

import { cn } from "@/lib/utils";
import type { Item } from "@contextkeeper/core";

export function StatusBadge({ status }: { status: Item['status'] }) {
  const statusColors = {
    TODO: "bg-zinc-100 text-zinc-700 border-zinc-200",
    IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
    DONE: "bg-green-50 text-green-700 border-green-200",
    IGNORED: "bg-zinc-100 text-zinc-500 border-zinc-200 line-through",
  };

  const label = status.replace('_', ' ');

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
      statusColors[status] || statusColors.TODO
    )}>
      {label}
    </span>
  );
}
