"use client";

import { useEffect, useState } from "react";
import { ItemCard } from "@/components/shared/ItemCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { CheckSquare, Loader2, LayoutGrid, List } from "lucide-react";
import { getItems } from "@/lib/api";
import type { Item } from "@contextkeeper/core";
import { cn } from "@/lib/utils";

export default function TasksPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    async function load() {
      try {
        const res = await getItems({ type: 'TASK' });
        setItems(res.items);
      } catch (error) {
        console.error("Failed to load tasks:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const todoTasks = items.filter(i => i.status === 'OPEN');
  const doneTasks = items.filter(i => i.status === 'COMPLETE');

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        <header className="mb-6 sm:mb-8 flex items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage all your actionable items.</p>
          </div>
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg shrink-0">
            <button 
              onClick={() => setView('list')}
              aria-label="List view"
              className={cn("p-1.5 rounded-md transition-colors", view === 'list' ? "bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              <List className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setView('kanban')}
              aria-label="Kanban view"
              className={cn("p-1.5 rounded-md transition-colors", view === 'kanban' ? "bg-white shadow-sm" : "text-zinc-500 hover:text-zinc-900")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="flex-1 flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <EmptyState 
              icon={CheckSquare}
              title="No tasks yet"
              description="Extract tasks from your captures automatically, or create one manually."
              className="w-full max-w-md py-16 sm:py-24 border border-dashed border-border rounded-2xl"
            />
          </div>
        ) : view === 'list' ? (
          <div className="space-y-6 sm:space-y-8">
            {todoTasks.length > 0 && (
              <section>
                <h2 className="text-xs sm:text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">To Do ({todoTasks.length})</h2>
                <div className="grid grid-cols-1 gap-3">
                  {todoTasks.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
              </section>
            )}

            {doneTasks.length > 0 && (
              <section className="opacity-60">
                <h2 className="text-xs sm:text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">Done ({doneTasks.length})</h2>
                <div className="grid grid-cols-1 gap-3">
                  {doneTasks.map(item => <ItemCard key={item.id} item={item} />)}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
            {/* Kanban view */}
            <div className="bg-zinc-50/50 p-3.5 sm:p-4 rounded-xl border border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3 sm:mb-4 flex items-center justify-between">
                To Do <span className="bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full text-xs">{todoTasks.length}</span>
              </h2>
              <div className="space-y-3">
                {todoTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No tasks to do</p>
                ) : (
                  todoTasks.map(item => <ItemCard key={item.id} item={item} />)
                )}
              </div>
            </div>

            <div className="bg-zinc-50/50 p-3.5 sm:p-4 rounded-xl border border-zinc-100 opacity-75">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3 sm:mb-4 flex items-center justify-between">
                Done <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{doneTasks.length}</span>
              </h2>
              <div className="space-y-3">
                {doneTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No completed tasks</p>
                ) : (
                  doneTasks.map(item => <ItemCard key={item.id} item={item} />)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
