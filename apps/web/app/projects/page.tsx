"use client";

import { useEffect, useState } from "react";
import { ItemCard } from "@/components/shared/ItemCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Folder, Loader2 } from "lucide-react";
import { getItems } from "@/lib/api";
import type { Item } from "@contextkeeper/core";

export default function ProjectsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getItems();
        setItems(res.items.filter(i => i.project));
      } catch (error) {
        console.error("Failed to load projects:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group by project
  const projects = items.reduce((acc, item) => {
    if (!item.project) return acc;
    if (!acc[item.project]) acc[item.project] = [];
    acc[item.project].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Items organized by project.</p>
        </header>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
          </div>
        ) : Object.keys(projects).length === 0 ? (
          <EmptyState 
            icon={Folder}
            title="No projects yet"
            description="When you capture items, we'll automatically group them by project."
            className="py-16 sm:py-24 border border-dashed border-border rounded-2xl"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {Object.entries(projects).map(([project, projectItems]) => (
              <div key={project} className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-zinc-100">
                  <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2 truncate">
                    <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400 shrink-0" />
                    <span className="truncate">{project}</span>
                  </h2>
                  <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full shrink-0">
                    {projectItems.length} items
                  </span>
                </div>
                <div className="space-y-3">
                  {projectItems.slice(0, 3).map(item => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                  {projectItems.length > 3 && (
                    <div className="text-center pt-2">
                      <button className="text-sm text-zinc-500 hover:text-zinc-900 font-medium">
                        View {projectItems.length - 3} more
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
