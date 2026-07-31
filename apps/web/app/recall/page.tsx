"use client";

import { useState } from "react";
import { askRecall } from "@/lib/api";
import { Search, Loader2, Sparkles, User, Bot, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function RecallPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await askRecall(userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error searching your memory." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black to-transparent rounded-[100%] blur-3xl" />
      </div>

      <header className="px-8 py-6 z-10">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Recall <Sparkles className="w-6 h-6 text-zinc-400" />
        </h1>
        <p className="text-muted-foreground mt-1">Ask questions about your captured knowledge.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-32 z-10">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="mt-20 text-center">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-8 h-8 text-zinc-400" />
              </div>
              <h2 className="text-xl font-medium mb-2">What are you looking for?</h2>
              <p className="text-muted-foreground mb-8">
                Try asking "What did John say about the Q3 budget?" or "Show me tasks for the Alpha project."
              </p>
              
              <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto text-left">
                {[
                  "What are my top priorities this week?",
                  "Summarize my meeting with Sarah.",
                  "Find all ideas related to marketing.",
                  "Who is working on the new website?"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(suggestion)}
                    className="p-4 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-700 transition-colors"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-4", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}
                  
                  <div className={cn(
                    "max-w-[80%] px-5 py-3.5 rounded-2xl",
                    msg.role === 'user' 
                      ? "bg-zinc-100 text-zinc-900 rounded-tr-sm" 
                      : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-sm shadow-sm prose prose-sm prose-zinc"
                  )}>
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    )}
                  </div>
                  
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-zinc-500" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="bg-white border border-zinc-200 px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-background via-background to-transparent pt-12 z-20">
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative bg-white shadow-lg border border-zinc-200 rounded-2xl overflow-hidden flex items-end focus-within:ring-2 focus-within:ring-zinc-900 focus-within:border-transparent transition-all"
          >
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything..."
              className="w-full max-h-32 min-h-[56px] resize-none border-none outline-none py-4 pl-4 pr-14 text-base placeholder:text-zinc-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="absolute right-2 bottom-2 w-10 h-10 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-white rounded-xl flex items-center justify-center transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </form>
          <div className="text-center mt-3">
            <span className="text-xs text-zinc-400 flex items-center justify-center gap-1">
              <Command className="w-3 h-3" /> Press Enter to send
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
