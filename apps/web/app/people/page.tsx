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
        setItems(res.items.filter(i => i.people && i.people.length > 0));
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
    if (!item.people) return acc;
    item.people.forEach(person => {
      if (!acc[person]) acc[person] = [];
      acc[person].push(item);
    });
    return acc;
  }, {} as Record<string, Item[]>);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground mt-1">Items organized by person.</p>
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
            className="py-24 border border-dashed border-border rounded-2xl"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(people).map(([person, personItems]) => (
              <div key={person} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 font-semibold border border-zinc-200">
                      {person.charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-lg font-semibold">{person}</h2>
                  </div>
                  <span className="text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-full">
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
