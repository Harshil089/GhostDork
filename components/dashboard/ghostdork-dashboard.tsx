"use client";

import * as React from "react";
import { LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { HistoryResponse, ResearchTab, SessionHistoryItem } from "@/lib/types/osint";

import { HistorySidebar } from "./history-sidebar";
import { QueryBuilderTab } from "./tabs/query-builder-tab";
import { DocumentScanTab } from "./tabs/document-scan-tab";
import { ImageAiTab } from "./tabs/image-ai-tab";
import { TargetSweepTab } from "./tabs/target-sweep-tab";

interface GhostDorkDashboardProps {
  onLogout?: () => void;
  requireAuth?: boolean;
  version?: string;
}

export function GhostDorkDashboard({
  onLogout,
  requireAuth = false,
  version = "0.1.0",
}: GhostDorkDashboardProps = {}) {
  const [activeTab, setActiveTab] = React.useState<ResearchTab>("query-builder");

  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [history, setHistory] = React.useState<SessionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(true);

  const [stats, setStats] = React.useState({
    query: { visibleResults: 0, executedQueries: 0, identifiers: 0 },
    batch: { visibleResults: 0, executedQueries: 0, identifiers: 0 },
    image: { visibleResults: 0, executedQueries: 0, identifiers: 0 },
    sweep: { visibleResults: 0, executedQueries: 0, identifiers: 0 },
  });

  const loadHistory = React.useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/history");
      if (res.ok) {
        const data = (await res.json()) as HistoryResponse;
        setHistory(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleUpdateStats = React.useCallback(
    (
      id: "query" | "batch" | "image" | "sweep",
      newStats: { visibleResults: number; executedQueries: number; identifiers: number },
    ) => {
      setStats((prev) => ({
        ...prev,
        [id]: newStats,
      }));
    },
    [],
  );

  const totalVisibleResults = Object.values(stats).reduce(
    (sum, tab) => sum + tab.visibleResults,
    0,
  );
  const totalExecutedQueries = Object.values(stats).reduce(
    (sum, tab) => sum + tab.executedQueries,
    0,
  );
  const totalIdentifiers = Object.values(stats).reduce(
    (sum, tab) => sum + tab.identifiers,
    0,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-background)]/80">
        <div className="flex h-14 items-center px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-sm font-bold tracking-[0.2em] text-white">
              GHOSTDORK
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex">
              v{version}
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-4 text-xs tracking-wider text-[var(--color-muted-foreground)] lg:flex">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 bg-[var(--color-accent)]" />
                {totalVisibleResults} HITS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 bg-[var(--color-accent)]" />
                {totalExecutedQueries} QUERIES
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 bg-[var(--color-accent)]" />
                {totalIdentifiers} ENTITIES
              </span>
            </div>

            <div className="h-4 w-px bg-[var(--color-border)] hidden lg:block" />

            {requireAuth && onLogout && (
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="mr-2 size-3.5" />
                End Session
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          items={history}
          loading={historyLoading}
        />

        <main className="flex-1 overflow-y-auto bg-[var(--color-background)]">
          <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as ResearchTab)}
              className="w-full"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="h-auto flex-wrap p-1">
                  <TabsTrigger value="query-builder" className="py-2.5">
                    Query Builder
                  </TabsTrigger>
                  <TabsTrigger value="document-scan" className="py-2.5">
                    Document Scan
                    {stats.batch.executedQueries > 0 && (
                      <Badge variant="muted" className="ml-2 bg-black/40">
                        {stats.batch.executedQueries}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="image-ai" className="py-2.5">
                    Image AI
                    {stats.image.identifiers > 0 && (
                      <Badge variant="muted" className="ml-2 bg-black/40">
                        {stats.image.identifiers}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="target-sweep" className="py-2.5">
                    Target Sweep
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="mt-6">
                <TabsContent value="query-builder" className="m-0 focus-visible:outline-none">
                  <QueryBuilderTab
                    onUpdateStats={handleUpdateStats}
                    onRefreshHistory={loadHistory}
                  />
                </TabsContent>

                <TabsContent value="document-scan" className="m-0 focus-visible:outline-none">
                  <DocumentScanTab
                    onUpdateStats={handleUpdateStats}
                    onRefreshHistory={loadHistory}
                  />
                </TabsContent>

                <TabsContent value="image-ai" className="m-0 focus-visible:outline-none">
                  <ImageAiTab
                    onUpdateStats={handleUpdateStats}
                    onRefreshHistory={loadHistory}
                  />
                </TabsContent>

                <TabsContent value="target-sweep" className="m-0 focus-visible:outline-none">
                  <TargetSweepTab
                    onUpdateStats={handleUpdateStats}
                    onRefreshHistory={loadHistory}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

export default GhostDorkDashboard;
