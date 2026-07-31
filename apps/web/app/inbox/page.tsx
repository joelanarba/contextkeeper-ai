"use client";

import { useEffect, useState } from "react";
import { ItemCard } from "@/components/shared/ItemCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Inbox, Loader2 } from "lucide-react";
import { getItems } from "@/lib/api";
import type { Item } from "@contextkeeper/core";

export default function InboxPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getItems({ status: 'TODO' });
        setItems(res.items);
      } catch (error) {
        console.error("Failed to load inbox:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground mt-1">Review and process your captured items.</p>
          </div>
          <div className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full text-sm font-medium">
            {items.length} items
          </div>
        </header>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState 
            icon={Inbox}
            title="Inbox Zero"
            description="You've processed all your captured items. Great job!"
            className="py-24 border border-dashed border-border rounded-2xl"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {items.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
