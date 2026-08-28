"use client";

import { useEffect, useState } from "react";
import { getItems, updateItem, deleteItem } from "@/lib/api";
import type { Item } from "@contextkeeper/core";
import { ItemCard } from "@/components/shared/ItemCard";
import { Loader2, Check, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ReviewPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviewItems();
  }, []);

  async function fetchReviewItems() {
    try {
      setLoading(true);
      const res = await getItems({ status: 'NEEDS_REVIEW' });
      setItems(res.items);
    } catch (err: any) {
      toast.error("Failed to load items needing review");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(item: Item) {
    try {
      await updateItem(item.id, { status: 'OPEN' });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Item confirmed and moved to inbox");
    } catch (err) {
      toast.error("Failed to confirm item");
    }
  }

  async function handleDiscard(item: Item) {
    try {
      await deleteItem(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success("Item discarded");
    } catch (err) {
      toast.error("Failed to discard item");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          Needs Review
        </h1>
        <p className="text-zinc-500 mt-1">
          Items extracted with low confidence. Review them before they enter your inbox.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 bg-zinc-50 border border-dashed rounded-xl">
          <p className="text-zinc-500">All caught up! No items need review.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 items-start">
              <div className="flex-1">
                <ItemCard item={item} />
              </div>
              <div className="flex flex-col gap-2 pt-1 shrink-0">
                <button
                  onClick={() => handleConfirm(item)}
                  className="flex items-center justify-center gap-2 bg-zinc-900 text-white px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Confirm item"
                >
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Confirm</span>
                </button>
                <button
                  onClick={() => handleDiscard(item)}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                  aria-label="Discard item"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Discard</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
