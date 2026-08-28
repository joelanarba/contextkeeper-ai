"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  Inbox, 
  Search, 
  CheckSquare, 
  Folder, 
  Users, 
  Settings, 
  PlusCircle,
  AlertTriangle,
  LayoutDashboard,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { CommandPalette } from "./CommandPalette";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Capture", href: "/capture", icon: PlusCircle },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Recall", href: "/recall", icon: Search },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "People", href: "/people", icon: Users },
  { name: "Needs Review", href: "/review", icon: AlertTriangle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Close mobile drawer when pathname changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileOpen]);

  const navContent = (
    <>
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-zinc-100 text-zinc-900 font-semibold" 
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-zinc-900" : "text-zinc-500")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <button
          onClick={() => {
            setMobileOpen(false);
            setCommandPaletteOpen(true);
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
        >
          <span className="flex items-center gap-3">
            <Search className="w-4 h-4 shrink-0 text-zinc-500" />
            Quick Search
          </span>
          <kbd className="hidden md:inline-flex pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ⌘K
          </kbd>
        </button>

        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            pathname === "/settings" 
              ? "bg-zinc-100 text-zinc-900 font-semibold" 
              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <Settings className="w-4 h-4 shrink-0 text-zinc-500" />
          Settings
        </Link>

        <button
          onClick={() => {
            setMobileOpen(false);
            signOut();
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile Top Header Bar (< md) ── */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-background/95 backdrop-blur border-b border-border px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            className="p-2 -ml-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="font-bold text-base tracking-tight text-zinc-900">
            ContextKeeper
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>
          <Link
            href="/capture"
            className="flex items-center gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Capture</span>
          </Link>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop & Panel (< md) ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-background border-r border-border flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <Link 
                href="/" 
                onClick={() => setMobileOpen(false)} 
                className="text-lg font-bold tracking-tight text-zinc-900"
              >
                ContextKeeper
              </Link>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {navContent}
          </aside>
        </div>
      )}

      {/* ── Desktop Permanent Sidebar (>= md) ── */}
      <aside className="hidden md:flex w-64 border-r border-border bg-background h-screen flex-col fixed left-0 top-0 z-20">
        <div className="p-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-zinc-900">
            ContextKeeper
          </Link>
        </div>

        {navContent}
      </aside>

      {/* Global Command Palette */}
      <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
    </>
  );
}
