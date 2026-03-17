import * as React from "react";
import { TerminalSquare } from "lucide-react";
import { SessionHistoryItem } from "@/lib/types/osint";
import { LoadingSkeleton } from "./shared";
import { truncate } from "@/lib/utils";

interface HistorySidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SessionHistoryItem[];
  loading: boolean;
}

export function HistorySidebar({
  open,
  onOpenChange,
  items,
  loading,
}: HistorySidebarProps) {
  // We can treat this as a persistent sidebar on large screens, or expandable
  return (
    <aside className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col hidden lg:flex">
      <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <div className="font-semibold text-white">Session History</div>
          <div className="text-xs text-[var(--color-muted-foreground)]">Redis-backed stream</div>
        </div>
        <TerminalSquare className="size-4 text-[var(--color-accent)]" />
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-left transition-colors hover:border-[var(--color-accent)]/40 hover:bg-black/30"
              onClick={() => {
                // Here we could plug in a context to change the active tab. For now, it's view-only.
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    {item.kind.replace(/-/g, " ")}
                  </div>
                  <div className="mt-1 text-sm font-medium text-white truncate">
                    {item.label}
                  </div>
                  {item.summary ? (
                    <div className="mt-1 text-xs text-[var(--color-muted-foreground)] line-clamp-2 break-words">
                      {truncate(item.summary, 80)}
                    </div>
                  ) : null}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="text-sm text-[var(--color-muted-foreground)] p-4 border border-dashed border-[var(--color-border)] text-center">
            Run your first query or pipeline to populate replayable history.
          </div>
        )}
      </div>
    </aside>
  );
}
