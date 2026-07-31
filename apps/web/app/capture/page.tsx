"use client";

import { useState } from "react";
import { createTextCapture } from "@/lib/api";
import { toast } from "sonner";
import { Send, Mic, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CapturePage() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'text' | 'voice' | 'file'>('text');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await createTextCapture(text);
      toast.success("Captured successfully", {
        description: "Your thought has been saved and is being processed."
      });
      setText("");
    } catch (err) {
      toast.error("Failed to capture", {
        description: err instanceof Error ? err.message : "An unknown error occurred"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
          <p className="text-muted-foreground mt-2">
            Dump your thoughts, meeting notes, or ideas here. We'll organize them automatically.
          </p>
        </header>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col max-h-[600px]">
          <div className="flex border-b border-border">
            <button 
              onClick={() => setActiveTab('text')}
              className={cn(
                "flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                activeTab === 'text' ? "text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
              )}
            >
              <FileText className="w-4 h-4" /> Text
            </button>
            <button 
              onClick={() => setActiveTab('voice')}
              className={cn(
                "flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                activeTab === 'voice' ? "text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
              )}
            >
              <Mic className="w-4 h-4" /> Voice
            </button>
            <button 
              onClick={() => setActiveTab('file')}
              className={cn(
                "flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                activeTab === 'file' ? "text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
              )}
            >
              <ImageIcon className="w-4 h-4" /> Image / PDF
            </button>
          </div>

          <div className="p-6 flex-1 flex flex-col">
            {activeTab === 'text' && (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type anything here... e.g. 'Meeting with Sarah tomorrow at 2pm about the new design system. Need to follow up with John regarding the budget.'"
                  className="flex-1 w-full resize-none border-none outline-none text-lg bg-transparent placeholder:text-zinc-400 focus:ring-0 p-0"
                  autoFocus
                />
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded border font-mono">⌘ + Enter</kbd> to submit
                  </p>
                  <button
                    type="submit"
                    disabled={!text.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Capture
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'voice' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6 border border-zinc-200">
                  <Mic className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Record Audio</h3>
                <p className="text-muted-foreground mb-8 max-w-sm">
                  Record your thoughts, meetings, or interviews. We'll transcribe and extract actionable insights.
                </p>
                <button className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium px-6 py-2.5 rounded-full flex items-center gap-2 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  Start Recording
                </button>
                <p className="text-xs text-zinc-400 mt-6">(Voice recording coming soon)</p>
              </div>
            )}

            {activeTab === 'file' && (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl bg-zinc-50/50 hover:bg-zinc-50 transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-6 h-6 text-zinc-400" />
                </div>
                <h3 className="font-semibold mb-1">Upload a File</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop or click to select
                </p>
                <p className="text-xs text-zinc-400 mt-6 mt-2">Supports JPG, PNG, PDF</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
