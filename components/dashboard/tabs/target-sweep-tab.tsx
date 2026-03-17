import * as React from "react";
import { AlertTriangle, Download, Radar } from "lucide-react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { buildTargetSweepQueries } from "@/lib/query";

import {
  SectionLabel,
  TypewriterText,
  LoadingSkeleton,
  EmptyState,
  ResultCard,
  Counter,
  parseApiResponse,
  exportJson,
  exportPdf,
  TargetSweepResponse,
  SearchQueryResponse,
} from "../shared";
import { SweepTargetType } from "@/lib/types/osint";

const INITIAL_SWEEP_FORM = {
  target: "",
  type: "domain" as SweepTargetType,
};

interface TargetSweepTabProps {
  onUpdateStats: (
    id: "sweep",
    stats: { visibleResults: number; executedQueries: number; identifiers: number }
  ) => void;
  onRefreshHistory: () => void;
}

const DESCRIPTORS: Record<string, { label: string; description: string }> = {
  usernamePresence: {
    label: "Username Presence",
    description: "Cross-platform public profile discovery for the supplied handle.",
  },
  emailDocuments: {
    label: "Email in Documents",
    description: "Public document search for the supplied email address.",
  },
  nameDocuments: {
    label: "Name in Documents",
    description: "Public filetype discovery for the supplied personal name.",
  },
  domainDiscovery: {
    label: "Domain Document Discovery",
    description: "Domain-focused public document and artifact discovery.",
  },
  webMentions: {
    label: "General Web Mentions",
    description: "Broad site scan across all indexed pages and text.",
  },
};

export function TargetSweepTab({ onUpdateStats, onRefreshHistory }: TargetSweepTabProps) {
  const [sweepForm, setSweepForm] = React.useState(INITIAL_SWEEP_FORM);
  const [sweepLoading, setSweepLoading] = React.useState(false);
  const [sweepError, setSweepError] = React.useState<string | null>(null);
  const [sweepResult, setSweepResult] = React.useState<TargetSweepResponse | null>(null);

  // Alternative OSINT sources state
  const [shodanLoading, setShodanLoading] = React.useState(false);
  const [shodanResult, setShodanResult] = React.useState<any>(null);
  const [crtshLoading, setCrtshLoading] = React.useState(false);
  const [crtshResult, setCrtshResult] = React.useState<any>(null);

  React.useEffect(() => {
    const visibleResults = sweepResult?.sections.reduce(
      (sum, section) => sum + section.results.length,
      0,
    ) ?? 0;
    const executedQueries = sweepResult?.sections.length ?? 0;
    let identifiers = 0;
    if (shodanResult) identifiers += 1;
    if (crtshResult) identifiers += (crtshResult.subdomains?.length || 0);

    onUpdateStats("sweep", { visibleResults, executedQueries, identifiers });
  }, [sweepResult, shodanResult, crtshResult, onUpdateStats]);

  function inferSweepType(target: string): SweepTargetType {
    const value = target.trim();
    if (value.includes("@")) return "email";
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) return "domain";
    if (/^[a-z0-9._-]{3,}$/i.test(value) && !/\s/.test(value)) return "username";
    return "name";
  }

  async function fetchShodan(target: string) {
    try {
      setShodanLoading(true);
      const res = await fetch("/api/target/shodan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipOrDomain: target })
      });
      const data = await parseApiResponse<{ found: boolean; data?: any }>(res);
      setShodanResult(data.found ? data.data : null);
    } catch (e) {
      console.error("Shodan sweep error", e);
    } finally {
      setShodanLoading(false);
    }
  }

  async function fetchCrtsh(target: string) {
    try {
      setCrtshLoading(true);
      const res = await fetch("/api/target/crtsh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: target })
      });
      const data = await parseApiResponse<any>(res);
      setCrtshResult(data);
    } catch (e) {
      console.error("crt.sh sweep error", e);
    } finally {
      setCrtshLoading(false);
    }
  }

  async function handleRunSweep(event: React.FormEvent) {
    event.preventDefault();
    setSweepLoading(true);
    setSweepError(null);
    setSweepResult(null);
    setShodanResult(null);
    setCrtshResult(null);

    const target = sweepForm.target.trim();
    if (!target) return;

    try {
      const type = sweepForm.type;

      // 1. Fire off alternate OSINT queries in parallel if it's a domain
      if (type === "domain") {
        fetchShodan(target);
        fetchCrtsh(target);
      }

      // 2. Build local queries instead of using /api/target/sweep
      const queryMap = buildTargetSweepQueries({
        name: type === "name" ? target : undefined,
        email: type === "email" ? target : undefined,
        username: type === "username" ? target : undefined,
        domain: type === "domain" ? target : undefined,
      });

      const queries = Object.entries(queryMap).filter(([, q]) => Boolean(q.trim()));
      
      const sections = [];
      const MAX_RESULTS_PER_QUERY = 5;

      // Client-side orchestration: Process sequentially to avoid abusing Vercel/SerpAPI
      for (const [id, query] of queries) {
        const res = await fetch("/api/search/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            freeText: query,
          })
        });

        const data = await parseApiResponse<SearchQueryResponse>(res);
        const descriptor = DESCRIPTORS[id] || { label: id, description: "Coordinated search section." };
        
        sections.push({
          id,
          label: descriptor.label,
          description: descriptor.description,
          query,
          results: data.items.slice(0, MAX_RESULTS_PER_QUERY),
          totalResults: data.meta.totalResults,
        });

        // Update UI progressively
        setSweepResult({
          target,
          type,
          sections: [...sections],
          cached: false,
          generatedAt: new Date().toISOString(),
        });
      }

      // 3. Save to history manually once complete
      const finalResult = {
        target,
        type,
        sections,
        cached: false,
        generatedAt: new Date().toISOString(),
      };
      setSweepResult(finalResult);

      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "target-sweep",
          title: "Target sweep",
          query: target,
          payload: finalResult,
          target
        })
      });

      onRefreshHistory();
    } catch (error) {
      setSweepError(
        error instanceof Error ? error.message : "Target sweep failed.",
      );
    } finally {
      setSweepLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Target Research Dashboard</PanelTitle>
            <PanelDescription>
              Coordinate query bundles for usernames, emails, names,
              and domains into a collapsible research report.
            </PanelDescription>
          </div>
          <Radar className="size-4 text-[var(--color-accent)]" />
        </PanelHeader>

        <PanelContent>
          <form onSubmit={handleRunSweep} className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-2">
                <SectionLabel
                  label="Target"
                  hint="Enter a person name, email address, username, or domain."
                />
                <Input
                  value={sweepForm.target}
                  onChange={(event) => {
                    const val = event.target.value;
                    setSweepForm((current) => ({
                      ...current,
                      target: val,
                      type: val.trim() ? inferSweepType(val) : current.type
                    }));
                  }}
                  placeholder="alice@example.com or alice_wonder or example.com"
                />
              </div>

              <div className="space-y-2">
                <SectionLabel
                  label="Target type"
                  hint="Select the interpretation mode for coordinated sweep generation."
                />
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      "name",
                      "email",
                      "username",
                      "domain",
                    ] as SweepTargetType[]
                  ).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setSweepForm((current) => ({
                          ...current,
                          type,
                        }))
                      }
                      className={cn(
                        "border px-3 py-3 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors",
                        sweepForm.type === type
                          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sweepError ? (
              <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{sweepError}</span>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                glow
                disabled={sweepLoading || !sweepForm.target.trim()}
              >
                <Radar className="size-4" />
                {sweepLoading ? "Sweeping" : "Run Target Sweep"}
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSweepForm(INITIAL_SWEEP_FORM);
                  setSweepResult(null);
                  setSweepError(null);
                  setShodanResult(null);
                  setCrtshResult(null);
                }}
              >
                Reset Sweep
              </Button>

              {sweepResult ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      exportJson(
                        "ghostdork-target-sweep.json",
                        sweepResult,
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
                      void exportPdf(
                        "GhostDork Target Sweep",
                        sweepResult as unknown as Record<string, unknown>,
                      )
                    }
                  >
                    <Download className="size-4" />
                    Export PDF
                  </Button>
                </>
              ) : null}
            </div>
          </form>
        </PanelContent>
      </Panel>

      {(shodanResult || crtshResult || shodanLoading || crtshLoading) && sweepForm.type === "domain" && (
        <Panel>
          <PanelHeader>
            <div>
              <PanelTitle>Domain OSINT Sources</PanelTitle>
              <PanelDescription>
                Live Shodan host intelligence and crt.sh certificate transparency logs.
              </PanelDescription>
            </div>
          </PanelHeader>

          <PanelContent>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Shodan Host Data</CardTitle>
                  <CardDescription>Port scans, vulnerabilities, and host metadata.</CardDescription>
                </CardHeader>
                <CardContent>
                  {shodanLoading ? (
                    <LoadingSkeleton rows={3} />
                  ) : shodanResult ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <Counter value={shodanResult.ports?.length || 0} label="Open Ports" />
                        <Counter value={shodanResult.hostnames?.length || 0} label="Hostnames" />
                      </div>
                      <div className="border border-[var(--color-border)] bg-black/30 p-3 font-mono text-sm leading-7 text-[var(--color-accent)]">
                        <div><span className="text-[var(--color-muted-foreground)]">IP:</span> {shodanResult.ip_str}</div>
                        {shodanResult.org && <div><span className="text-[var(--color-muted-foreground)]">Org:</span> {shodanResult.org}</div>}
                        {shodanResult.os && <div><span className="text-[var(--color-muted-foreground)]">OS:</span> {shodanResult.os}</div>}
                      </div>
                      {shodanResult.ports?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {shodanResult.ports.map((port: number) => (
                            <Badge key={port} variant="outline">Port {port}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-muted-foreground)]">No Shodan host data found for this target.</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>crt.sh Subdomains</CardTitle>
                  <CardDescription>Certificate Transparency Log Subject Names</CardDescription>
                </CardHeader>
                <CardContent>
                  {crtshLoading ? (
                    <LoadingSkeleton rows={3} />
                  ) : crtshResult ? (
                    <div className="space-y-4">
                      <Counter value={crtshResult.subdomains?.length || 0} label="Extracted Subdomains" />
                      {crtshResult.subdomains?.length > 0 ? (
                        <div className="max-h-[320px] overflow-auto border border-[var(--color-border)] bg-black/30 p-3 font-mono text-sm leading-7 text-[var(--color-accent)]">
                          {crtshResult.subdomains.map((sub: string) => (
                            <div key={sub}>{sub}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--color-muted-foreground)]">No subdomains found in CT logs.</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--color-muted-foreground)]">crt.sh data unavailable.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </PanelContent>
        </Panel>
      )}

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Coordinated Sweep Report</PanelTitle>
            <PanelDescription>
              Expand sections to review query intent, matched results,
              and total result estimates.
            </PanelDescription>
          </div>

          {sweepResult ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{sweepResult.type}</Badge>
            </div>
          ) : null}
        </PanelHeader>

        <PanelContent>
          {sweepLoading && !sweepResult ? (
            <LoadingSkeleton rows={4} />
          ) : sweepResult ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Counter
                  value={sweepResult.sections.length}
                  label="Sections"
                />
                <Counter
                  value={sweepResult.sections.reduce(
                    (sum, section) => sum + section.results.length,
                    0,
                  )}
                  label="Visible Hits"
                />
                <Counter
                  value={sweepResult.sections.reduce(
                    (sum, section) => sum + section.totalResults,
                    0,
                  )}
                  label="Estimated Total"
                />
              </div>

              {sweepResult.sections.map((section) => (
                <details
                  key={section.id}
                  open
                  className="group border border-[var(--color-border)] bg-[var(--color-surface)]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                        {section.label}
                      </div>
                      <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                        {section.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {section.results.length} visible
                      </Badge>
                      <Badge variant="muted">
                        {formatNumber(section.totalResults)} total
                      </Badge>
                    </div>
                  </summary>

                  <div className="border-t border-[var(--color-border)] px-4 py-4">
                    <div className="mb-4 border border-[var(--color-border)] bg-black/30 p-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                        Generated Query
                      </div>
                      <div className="mt-2 break-words font-mono text-sm text-[var(--color-accent)]">
                        {section.query}
                      </div>
                    </div>

                    {section.results.length ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {section.results.map((item, index) => (
                          <ResultCard
                            key={`${item.link}-${index}`}
                            item={item}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="border border-[var(--color-border)] bg-black/20 p-4 text-sm text-[var(--color-muted-foreground)]">
                        No visible results returned for this section.
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Radar}
              title="No Sweep Report"
              body="Enter a target and run a coordinated research sweep to populate username presence, email appearance, name association, or domain discovery sections."
              command="ghostdork sweep --target <value>"
            />
          )}
        </PanelContent>
      </Panel>
    </div>
  );
}
