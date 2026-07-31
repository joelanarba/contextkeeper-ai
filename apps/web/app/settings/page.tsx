"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { Settings, LogOut, User, Bell, Lock, Palette } from "lucide-react";

export default function SettingsPage() {
  const { signOut, userId } = useAuth();

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Settings Sidebar */}
          <div className="col-span-1 space-y-1">
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-zinc-100 text-zinc-900 rounded-md">
              <User className="w-4 h-4" /> Account
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-md">
              <Palette className="w-4 h-4" /> Appearance
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-md">
              <Bell className="w-4 h-4" /> Notifications
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 rounded-md">
              <Lock className="w-4 h-4" /> Privacy & Security
            </button>
          </div>

          {/* Settings Content */}
          <div className="col-span-3 space-y-8">
            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Account Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-500 mb-1">User ID</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={userId || "Loading..."} 
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-700 font-mono"
                    />
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">This is your unique identifier in ContextKeeper AI.</p>
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
              <div className="flex items-center justify-between p-4 border border-red-100 bg-red-50/50 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-red-900">Sign Out</h3>
                  <p className="text-sm text-red-700/80">Log out of your current session.</p>
                </div>
                <button 
                  onClick={signOut}
                  className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
