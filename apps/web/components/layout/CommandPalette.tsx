"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, PlusCircle, Inbox, CheckSquare, Folder, Users, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandPalette({ open, setOpen }: Props) {
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setOpen(false)}
      />
      <Command 
        className="relative z-50 w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="w-5 h-5 text-muted-foreground mr-3" />
          <Command.Input 
            autoFocus
            placeholder="Type a command or search..." 
            className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-[15px]"
          />
        </div>

        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/capture"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <PlusCircle className="w-4 h-4" /> Capture New
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/inbox"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <Inbox className="w-4 h-4" /> Go to Inbox
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/recall"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <Search className="w-4 h-4" /> Ask Recall
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/tasks"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <CheckSquare className="w-4 h-4" /> View Tasks
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => router.push("/settings"))}
              className="flex items-center gap-2 px-2 py-2 rounded-md text-sm cursor-pointer aria-selected:bg-zinc-100 aria-selected:text-zinc-900 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900"
            >
              <Settings className="w-4 h-4" /> Settings
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
