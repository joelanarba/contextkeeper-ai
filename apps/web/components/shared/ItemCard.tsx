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
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
            <TypeBadge type={item.type} />
            <PriorityIndicator priority={item.priority} />
            <StatusBadge status={item.status} />
          </div>
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug break-words">
            {item.title}
          </h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-1">
        {item.dueDate && (
          <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 shrink-0">
            <CalendarIcon className="w-3 h-3" />
            <span className="font-medium">{formatDate(item.dueDate)}</span>
          </div>
        )}
        {item.person && (
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md shrink-0">
            <UserIcon className="w-3 h-3" />
            <span className="truncate max-w-[120px] sm:max-w-none">{item.personDisplay || item.person}</span>
          </div>
        )}
        {item.project && (
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2 py-0.5 rounded-md shrink-0">
            <span className="font-medium text-zinc-700 truncate max-w-[120px] sm:max-w-none">#{item.project}</span>
          </div>
        )}
        {item.confidence !== undefined && (
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md shrink-0 border ${item.confidence < 0.7 ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
            <span className="font-medium truncate max-w-[120px] sm:max-w-none">
              {Math.round(item.confidence * 100)}% Conf
            </span>
          </div>
        )}
        <div className="ml-auto text-[10px] text-zinc-400 shrink-0">
          {formatDate(item.createdAt)}
        </div>
      </div>
    </div>
  );
}
