"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";

export function Header({ title }: { title: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10 px-8 flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500 bg-zinc-50 hover:bg-zinc-100 border border-border rounded-md transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Search...</span>
          <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </header>
      
      <CommandPalette open={open} setOpen={setOpen} />
    </>
  );
}
