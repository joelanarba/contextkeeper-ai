"use client";

import { useEffect, useState } from "react";
import { ItemCard } from "@/components/shared/ItemCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Inbox, CheckSquare, Loader2 } from "lucide-react";
import { getItems } from "@/lib/api";
import type { Item } from "@contextkeeper/core";

export default function DashboardPage() {
  const [recentItems, setRecentItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [recentRes, tasksRes] = await Promise.all([
          getItems(), // Get all recent
          getItems({ type: 'TASK', status: 'TODO' })
        ]);
        setRecentItems(recentRes.items.slice(0, 5));
        setTasks(tasksRes.items.slice(0, 5));
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-12">
        <header>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Good morning</h1>
          <p className="text-muted-foreground">Here is what's happening today.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-600" />
                Active Tasks
              </h2>
            </div>
            
            {tasks.length === 0 ? (
              <EmptyState 
                icon={CheckSquare}
                title="No active tasks"
                description="You're all caught up for today."
                className="bg-card border border-border rounded-xl"
              />
            ) : (
              <div className="space-y-3">
                {tasks.map(item => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Inbox className="w-5 h-5 text-zinc-600" />
                Recent Items
              </h2>
            </div>
            
            {recentItems.length === 0 ? (
              <EmptyState 
                icon={Inbox}
                title="Your inbox is empty"
                description="Capture something new to see it here."
                className="bg-card border border-border rounded-xl"
              />
            ) : (
              <div className="space-y-3">
                {recentItems.map(item => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
