"use client";

import type { Item } from "@contextkeeper/core";
import { StatusBadge } from "./StatusBadge";
import { TypeBadge } from "./TypeBadge";
import { PriorityIndicator } from "./PriorityIndicator";
import { formatDate } from "@/lib/utils";
import { CalendarIcon, UserIcon } from "lucide-react";

interface ItemCardProps {
  item: Item;
  onClick?: (item: Item) => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <div 
      onClick={() => onClick?.(item)}
      className="group relative p-4 bg-card hover:bg-zinc-50 border border-border rounded-xl shadow-sm transition-all cursor-pointer flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 mb-1.5">
            <TypeBadge type={item.type} />
            <PriorityIndicator priority={item.priority} />
            <StatusBadge status={item.status} />
          </div>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {item.title}
          </h3>
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {item.summary}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
        {item.deadline && (
          <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
            <CalendarIcon className="w-3 h-3" />
            <span className="font-medium">{formatDate(item.deadline)}</span>
          </div>
        )}
        {item.people?.length > 0 && (
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md">
            <UserIcon className="w-3 h-3" />
            <span>{item.people.join(', ')}</span>
          </div>
        )}
        {item.project && (
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md">
            <span className="font-medium text-zinc-700">#{item.project}</span>
          </div>
        )}
        <div className="ml-auto text-[10px] text-zinc-400">
          {formatDate(item.createdAt)}
        </div>
      </div>
    </div>
  );
}
