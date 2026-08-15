"use client";

import { useEffect, useState } from "react";
import { ItemCard } from "@/components/shared/ItemCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Loader2 } from "lucide-react";
import { getItems } from "@/lib/api";
import type { Item } from "@contextkeeper/core";

export default function PeoplePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getItems();
        setItems(res.items.filter(i => !!i.person));
      } catch (error) {
        console.error("Failed to load people:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group by person
  const people = items.reduce((acc, item) => {
    const personKey = item.personDisplay || item.person;
    if (!personKey) return acc;
    if (!acc[personKey]) acc[personKey] = [];
    acc[personKey].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  return (
    <div className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">People</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Items organized by person.</p>
        </header>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
          </div>
        ) : Object.keys(people).length === 0 ? (
          <EmptyState 
            icon={Users}
            title="No people found"
            description="Mentions of people in your captures will appear here automatically."
            className="py-16 sm:py-24 border border-dashed border-border rounded-2xl"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {Object.entries(people).map(([person, personItems]) => (
              <div key={person} className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-zinc-100 gap-2">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-semibold text-xs sm:text-base border border-zinc-200 shrink-0">
                      {person.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold truncate">{person}</h2>
                  </div>
                  <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full shrink-0">
                    {personItems.length} items
                  </span>
                </div>
                <div className="space-y-3">
                  {personItems.slice(0, 3).map(item => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                  {personItems.length > 3 && (
                    <div className="text-center pt-2">
                      <button className="text-sm text-zinc-500 hover:text-zinc-900 font-medium">
                        View {personItems.length - 3} more
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
