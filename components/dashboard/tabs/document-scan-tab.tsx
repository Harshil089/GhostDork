import * as React from "react";
import { AlertTriangle, Download, FileSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Panel,
  PanelContent,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";

import {
  DEFAULT_BATCH_EXTENSIONS,
  FILE_FORMAT_GROUPS,
  FILE_FORMAT_LOOKUP,
} from "@/lib/data/presets";
import { cn } from "@/lib/utils";

import {
  SectionLabel,
  TypewriterText,
  LoadingSkeleton,
  EmptyState,
  Counter,
  FindingsTable,
  StatusDot,
  parseApiResponse,
  exportJson,
  exportCsv,
  BatchDiscoveryResponse,
  BatchFinding,
} from "../shared";

const INITIAL_BATCH_FORM = {
  target: "",
  includeConfigFormats: true,
  includeArchiveFormats: true,
  selectedExtensions: [...DEFAULT_BATCH_EXTENSIONS],
};

const SERPAPI_BATCH_RESTRICTED = true;

interface DocumentScanTabProps {
  onUpdateStats: (
    id: "batch",
    stats: { visibleResults: number; executedQueries: number; identifiers: number }
  ) => void;
  onRefreshHistory: () => void;
}

// Chunking function for array of extensions
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function DocumentScanTab({ onUpdateStats, onRefreshHistory }: DocumentScanTabProps) {
  const [batchForm, setBatchForm] = React.useState(INITIAL_BATCH_FORM);
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchError, setBatchError] = React.useState<string | null>(null);
  const [batchProgress, setBatchProgress] = React.useState(0);
  const [batchResult, setBatchResult] = React.useState<BatchDiscoveryResponse | null>(null);

  React.useEffect(() => {
    const visibleResults = batchResult?.findings.length ?? 0;
    const executedQueries = batchResult?.executedQueries.length ?? 0;
    onUpdateStats("batch", { visibleResults, executedQueries, identifiers: 0 });
  }, [batchResult, onUpdateStats]);

  function toggleExtension(extension: string) {
    setBatchForm((current) => {
      const exists = current.selectedExtensions.includes(extension);

      return {
        ...current,
        selectedExtensions: exists
          ? current.selectedExtensions.filter((item) => item !== extension)
          : [...current.selectedExtensions, extension],
      };
    });
  }

  async function handleRunBatchScan(event: React.FormEvent) {
    event.preventDefault();
    setBatchLoading(true);
    setBatchError(null);
    setBatchProgress(0);

    if (SERPAPI_BATCH_RESTRICTED) {
      setBatchResult({
        target: batchForm.target.trim(),
        progress: {
          completed: 0,
          total: 0,
          status: "complete",
        },
        findings: [],
        executedQueries: [],
        cached: false,
        serpApiRestricted: true,
        serpApiRestrictionReason:
          "Batch discovery is disabled by SerpAPI policy. Use Build Query or Target Sweep (name/email/username).",
        generatedAt: new Date().toISOString(),
      });
      setBatchProgress(0);
      setBatchLoading(false);
      return;
    }

    try {
      // 1. Resolve extensions on client-side
      const targetExtensions = new Set(batchForm.selectedExtensions);
      if (batchForm.includeConfigFormats) {
        Object.values(FILE_FORMAT_LOOKUP).forEach(f => {
          if (f.group === "config") targetExtensions.add(f.extension);
        });
      }
      if (batchForm.includeArchiveFormats) {
        Object.values(FILE_FORMAT_LOOKUP).forEach(f => {
          if (f.group === "archive") targetExtensions.add(f.extension);
        });
      }

      const allExtensions = Array.from(targetExtensions);
      if (allExtensions.length === 0) {
        throw new Error("No extensions selected for discovery.");
      }

      // 2. Chunk them to avoid Vercel timeouts (e.g. 5 per request)
      const chunks = chunkArray(allExtensions, 3);
      
      let accumulatedFindings: BatchFinding[] = [];
      let accumulatedQueries: string[] = [];
      let completedQueries = 0;

      // Ensure fresh result structure locally
      setBatchResult({
        target: batchForm.target,
        progress: {
          completed: 0,
          total: allExtensions.length, // total extensions to search
          status: "running"
        },
        findings: [],
        executedQueries: [],
        cached: false,
        generatedAt: new Date().toISOString(),
      });

      // 3. Process each chunk sequentially doing fetch
      for (const chunk of chunks) {
        const response = await fetch("/api/search/batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: batchForm.target,
            includeConfigFormats: false,
            includeArchiveFormats: false,
            extensions: chunk,
            skipHistory: true // Prevent server from polluting history with chunks
          }),
        });

        const data = await parseApiResponse<BatchDiscoveryResponse>(response);
        
        accumulatedFindings = [...accumulatedFindings, ...data.findings];
        accumulatedQueries = [...accumulatedQueries, ...data.executedQueries];
        completedQueries += data.executedQueries.length;
        
        setBatchProgress(Math.min(95, Math.round((completedQueries / allExtensions.length) * 100)));
        
        setBatchResult((prev) => prev ? ({
          ...prev,
          findings: accumulatedFindings,
          executedQueries: accumulatedQueries,
          progress: {
            completed: completedQueries,
            total: allExtensions.length,
            status: "running",
          }
        }) : null);
      }

      const finalResult: BatchDiscoveryResponse = {
        target: batchForm.target,
        progress: {
          completed: completedQueries,
          total: allExtensions.length,
          status: "complete",
        },
        findings: accumulatedFindings,
        executedQueries: accumulatedQueries,
        cached: false,
        generatedAt: new Date().toISOString(),
      };

      setBatchResult(finalResult);
      setBatchProgress(100);

      // 4. Save aggregated history manually
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "batch-discovery",
          title: "Batch discovery",
          query: batchForm.target,
          payload: finalResult,
          target: batchForm.target,
          extensions: allExtensions
        })
      });

      onRefreshHistory();
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : "Batch scan failed.",
      );
      setBatchResult((prev) => prev ? ({...prev, progress: {...prev.progress, status: "error"}}) : null);
      setBatchProgress(0);
    } finally {
      setTimeout(() => setBatchLoading(false), 300);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Multi-Format Document Discovery</PanelTitle>
            <PanelDescription>
              Generate parallel document, config, and archive pivots
              across indexed public file extensions.
            </PanelDescription>
          </div>
          <FileSearch className="size-4 text-[var(--color-accent)]" />
        </PanelHeader>

        <PanelContent>
          <form onSubmit={handleRunBatchScan} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-2">
                <SectionLabel
                  label="Domain or keyword seed"
                  hint="Enter a domain, organization keyword, or topic to expand across filetypes."
                />
                <Input
                  value={batchForm.target}
                  onChange={(event) =>
                    setBatchForm((current) => ({
                      ...current,
                      target: event.target.value,
                    }))
                  }
                  placeholder="example.com or threat intel keyword"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setBatchForm((current) => ({
                      ...current,
                      includeConfigFormats:
                        !current.includeConfigFormats,
                    }))
                  }
                  className={cn(
                    "border p-3 text-left transition-colors",
                    batchForm.includeConfigFormats
                      ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]",
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    Config
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {batchForm.includeConfigFormats
                      ? "Included"
                      : "Excluded"}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setBatchForm((current) => ({
                      ...current,
                      includeArchiveFormats:
                        !current.includeArchiveFormats,
                    }))
                  }
                  className={cn(
                    "border p-3 text-left transition-colors",
                    batchForm.includeArchiveFormats
                      ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]",
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                    Archives
                  </div>
                  <div className="mt-2 text-sm text-white">
                    {batchForm.includeArchiveFormats
                      ? "Included"
                      : "Excluded"}
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <SectionLabel
                label="Extension matrix"
                hint="Choose the formats to include in the scan batch."
              />

              {FILE_FORMAT_GROUPS.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white">
                      {group.label}
                    </div>
                    <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                      {group.description}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.values(FILE_FORMAT_LOOKUP)
                      .filter((format) => format.group === group.key)
                      .map((format) => {
                        const active =
                          batchForm.selectedExtensions.includes(
                            format.extension,
                          );

                        return (
                          <button
                            key={format.extension}
                            type="button"
                            onClick={() =>
                              toggleExtension(format.extension)
                            }
                            className={cn(
                              "border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
                              active
                                ? format.badgeClass
                                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
                            )}
                          >
                            {format.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {batchError ? (
              <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{batchError}</span>
              </div>
            ) : null}

            {batchResult?.serpApiRestricted ? (
              <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {batchResult.serpApiRestrictionReason ||
                    "Batch discovery is restricted by current SerpAPI access policy."}
                </span>
              </div>
            ) : null}

            {batchLoading ? (
              <div className="space-y-3">
                <Progress value={batchProgress} showValueLabel />
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                  <StatusDot active />
                  batch execution in progress - requesting parallel chunks
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                glow
                disabled={batchLoading || !batchForm.target.trim() || SERPAPI_BATCH_RESTRICTED}
              >
                <FileSearch className="size-4" />
                {batchLoading ? "Scanning" : "Launch Scan"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setBatchForm(INITIAL_BATCH_FORM);
                  setBatchResult(null);
                  setBatchError(null);
                  setBatchProgress(0);
                }}
              >
                Reset Scan
              </Button>

              {batchResult ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      exportJson(
                        "ghostdork-batch-findings.json",
                        batchResult,
                      )
                    }
                  >
                    <Download className="size-4" />
                    Export JSON
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      exportCsv(
                        "ghostdork-batch-findings.csv",
                        batchResult.findings.map((finding) => ({
                          extension: finding.extension,
                          category: finding.category,
                          title: finding.title,
                          link: finding.link,
                          snippet: finding.snippet,
                          query: finding.query,
                        })),
                      )
                    }
                  >
                    <Download className="size-4" />
                    Export CSV
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Unified Findings Table</PanelTitle>
            <PanelDescription>
              Color-coded filetype badges with aggregated multi-format
              discovery output.
            </PanelDescription>
          </div>

          {batchResult ? (
            <div className="flex items-center gap-2">
              <Badge
                variant={batchResult.cached ? "info" : "default"}
              >
                {batchResult.cached ? "cache hit" : "fresh batch"}
              </Badge>
              <Badge variant="outline">
                {batchResult.findings.length} findings
              </Badge>
            </div>
          ) : null}
        </PanelHeader>

        <PanelContent className="space-y-6">
          {batchLoading && !batchResult?.findings.length ? (
            <LoadingSkeleton rows={5} />
          ) : batchResult ? (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Counter
                  value={batchResult.findings.length}
                  label="Findings"
                />
                <Counter
                  value={batchResult.executedQueries.length}
                  label="Queries"
                />
                <Counter
                  value={batchResult.progress.total}
                  label="Total Batches"
                />
                <Counter
                  value={batchResult.progress.completed}
                  label="Completed"
                />
              </div>
              <FindingsTable findings={batchResult.findings} />
            </>
          ) : (
            <EmptyState
              icon={FileSearch}
              title="No Document Scan Executed"
              body="Provide a target seed and select desired file extensions to launch a parallelized public document discovery batch."
              command="ghostdork scan --formats all --parallel"
            />
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
