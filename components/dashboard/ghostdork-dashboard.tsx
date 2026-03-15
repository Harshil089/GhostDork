"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bot,
  Download,
  ExternalLink,
  FileSearch,
  ImagePlus,
  Radar,
  Search,
  Shield,
  TerminalSquare,
  Upload,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_BATCH_EXTENSIONS,
  FILE_FORMAT_GROUPS,
  FILE_FORMAT_LOOKUP,
  QUERY_PRESET_CATEGORIES,
  QUERY_PRESETS,
  SEARCH_OPERATORS,
} from "@/lib/data/presets";
import { buildSearchQuery } from "@/lib/query";
import { cn, formatNumber, jsonToCsv, truncate } from "@/lib/utils";

type ResearchTab =
  | "query-builder"
  | "document-scan"
  | "image-ai"
  | "target-sweep";
type SweepType = "name" | "email" | "username" | "domain";

type SearchResultItem = {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  filetype?: string;
};

type SearchQueryResponse = {
  meta: {
    query: string;
    totalResults: number;
    startIndex: number;
    count: number;
    cached: boolean;
    source: "google" | "cache" | "mock";
    generatedAt: string;
  };
  items: SearchResultItem[];
  followUpQueries?: Array<{
    site: string;
    query: string;
    results: SearchResultItem[];
    totalResults: number;
  }>;
};

type BatchFinding = SearchResultItem & {
  extension: string;
  category: string;
  query: string;
};

type BatchDiscoveryResponse = {
  target: string;
  progress: {
    completed: number;
    total: number;
    status: "idle" | "running" | "complete" | "error";
  };
  findings: BatchFinding[];
  executedQueries: string[];
  cached: boolean;
  generatedAt: string;
};

type ImageIdentifier = {
  type: string;
  value: string;
  confidence: number;
  context?: string;
};

type ImageAnalysisResponse = {
  sourceType: "upload" | "url";
  ocr: {
    rawText: string;
    blocks: Array<{ text: string; confidence?: number }>;
    durationMs?: number;
  };
  vision: {
    summary: string;
    identifiers: ImageIdentifier[];
    model?: string;
  };
  generatedQueries: Array<{
    identifier: string;
    identifierType: string;
    query: string;
  }>;
  relatedResults?: SearchQueryResponse[];
  generatedAt: string;
};

type SweepSection = {
  id: string;
  label: string;
  description: string;
  query: string;
  results: SearchResultItem[];
  totalResults: number;
};

type TargetSweepResponse = {
  target: string;
  type: SweepType;
  sections: SweepSection[];
  cached: boolean;
  generatedAt: string;
};

type SessionHistoryItem = {
  id: string;
  label: string;
  kind:
  | "structured-query"
  | "batch-discovery"
  | "image-analysis"
  | "target-sweep";
  summary?: string;
  createdAt: string;
  input: Record<string, unknown>;
};

type ApiError = {
  error: string;
  details?: string;
};

const EMPTY_HISTORY: SessionHistoryItem[] = [];

const INITIAL_QUERY_FORM = {
  site: "",
  inurl: "",
  intitle: "",
  intext: "",
  filetype: "",
  before: "",
  after: "",
  freeText: "",
  exactTerms: "",
  excludeTerms: "",
};

const INITIAL_BATCH_FORM = {
  target: "",
  includeConfigFormats: true,
  includeArchiveFormats: true,
  selectedExtensions: [...DEFAULT_BATCH_EXTENSIONS],
};

const INITIAL_IMAGE_FORM: {
  imageUrl: string;
  imageBase64: string;
  filename: string;
  sourceType: "upload" | "url";
} = {
  imageUrl: "",
  imageBase64: "",
  filename: "",
  sourceType: "url",
};

const INITIAL_SWEEP_FORM = {
  target: "",
  type: "username" as SweepType,
};

function TypewriterText({
  text,
  active = true,
  speed = 24,
  className,
}: {
  text: string;
  active?: boolean;
  speed?: number;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(active ? 0 : text.length);

  React.useEffect(() => {
    if (!active) {
      setVisible(text.length);
      return;
    }

    setVisible(0);
    const timer = window.setInterval(() => {
      setVisible((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }

        return current + 1;
      });
    }, speed);

    return () => window.clearInterval(timer);
  }, [active, speed, text]);

  return (
    <span className={className}>
      {text.slice(0, visible)}
      {active && visible < text.length ? (
        <span className="ml-0.5 inline-block h-[1em] w-2 animate-pulse bg-[var(--color-accent)] align-middle" />
      ) : null}
    </span>
  );
}

function StatusDot({
  active = false,
  danger = false,
}: {
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full border border-black/40",
        active &&
        "animate-pulse bg-[var(--color-accent)] shadow-[0_0_14px_rgba(0,255,136,0.7)]",
        danger &&
        "bg-[var(--color-alert)] shadow-[0_0_14px_rgba(255,51,51,0.55)]",
        !active && !danger && "bg-[var(--color-muted)]",
      )}
    />
  );
}

function SectionLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--color-accent)]">
        {label}
      </div>
      {hint ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p>
      ) : null}
    </div>
  );
}

function Counter({ value, label }: { value: number; label: string }) {
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    const duration = 320;
    const start = performance.now();
    const from = display;
    const to = value;

    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min((time - start) / duration, 1);
      const next = Math.round(from + (to - from) * progress);
      setDisplay(next);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, display]);

  return (
    <div className="border border-[var(--color-border)] bg-black/30 p-3">
      <div className="font-mono text-xl font-semibold text-[var(--color-accent)]">
        {formatNumber(display)}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--color-muted-foreground)]">
        {label}
      </div>
    </div>
  );
}

function ResultCard({ item }: { item: SearchResultItem }) {
  const ext = item.filetype?.toLowerCase() ?? "";
  const formatMeta = FILE_FORMAT_LOOKUP[ext];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="leading-6 text-white">
              {item.title || "Untitled Result"}
            </CardTitle>
            <CardDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
              {item.displayLink || item.link}
            </CardDescription>
          </div>

          {formatMeta ? (
            <Badge className={cn("shrink-0", formatMeta.badgeClass)}>
              {formatMeta.label}
            </Badge>
          ) : item.filetype ? (
            <Badge variant="muted" className="shrink-0">
              {item.filetype}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-[var(--color-muted-foreground)]">
          {item.snippet || "No snippet returned for this result."}
        </p>

        <div className="flex items-center gap-2">
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="size-4" />
              Open Result
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function FindingsTable({ findings }: { findings: BatchFinding[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Category</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.length ? (
          findings.map((finding, index) => {
            const meta = FILE_FORMAT_LOOKUP[finding.extension];

            return (
              <TableRow key={`${finding.link}-${index}`}>
                <TableCell>
                  {meta ? (
                    <Badge className={meta.badgeClass}>{meta.label}</Badge>
                  ) : (
                    <Badge variant="muted">{finding.extension}</Badge>
                  )}
                </TableCell>
                <TableCell className="min-w-[240px]">
                  <div className="space-y-1">
                    <div className="font-medium text-white">
                      {truncate(finding.title, 70)}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
                      {truncate(finding.query, 84)}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[420px]">
                  <a
                    href={finding.link}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm text-[var(--color-accent)] hover:underline"
                  >
                    {finding.link}
                  </a>
                </TableCell>
                <TableCell className="capitalize text-[var(--color-muted-foreground)]">
                  {finding.category}
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow>
            <TableCell
              colSpan={4}
              className="py-8 text-center text-[var(--color-muted-foreground)]"
            >
              No findings returned for this scan.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="h-3 w-32 animate-pulse bg-white/8" />
          <div className="mt-3 h-4 w-2/3 animate-pulse bg-white/10" />
          <div className="mt-2 h-4 w-full animate-pulse bg-white/6" />
          <div className="mt-2 h-4 w-5/6 animate-pulse bg-white/6" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  command,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  command?: string;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center border border-dashed border-[var(--color-border)] bg-black/20 px-6 py-10 text-center">
      <Icon className="size-10 text-[var(--color-accent)]" />
      <div className="mt-5 font-mono text-sm uppercase tracking-[0.24em] text-white">
        {title}
      </div>
      <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--color-muted-foreground)]">
        {body}
      </p>
      {command ? (
        <div className="mt-4 border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-accent)]">
          <TypewriterText text={command} />
        </div>
      ) : null}
    </div>
  );
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const err = data as ApiError;
    throw new Error(err.details || err.error || "Request failed.");
  }

  return data as T;
}

function inferSweepType(value: string): SweepType {
  const input = value.trim();

  if (input.includes("@")) {
    return "email";
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(input)) {
    return "domain";
  }

  if (/^[a-z0-9._-]{3,}$/i.test(input) && !/\s/.test(input)) {
    return "username";
  }

  return "name";
}

export function GhostDorkDashboard() {
  const [activeTab, setActiveTab] =
    React.useState<ResearchTab>("query-builder");
  const [history, setHistory] =
    React.useState<SessionHistoryItem[]>(EMPTY_HISTORY);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const [queryForm, setQueryForm] = React.useState(INITIAL_QUERY_FORM);
  const [queryLoading, setQueryLoading] = React.useState(false);
  const [queryError, setQueryError] = React.useState<string | null>(null);
  const [queryResult, setQueryResult] =
    React.useState<SearchQueryResponse | null>(null);

  const [batchForm, setBatchForm] = React.useState(INITIAL_BATCH_FORM);
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchError, setBatchError] = React.useState<string | null>(null);
  const [batchProgress, setBatchProgress] = React.useState(0);
  const [batchResult, setBatchResult] =
    React.useState<BatchDiscoveryResponse | null>(null);

  const [imageForm, setImageForm] = React.useState(INITIAL_IMAGE_FORM);
  const [imageLoading, setImageLoading] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [imageResult, setImageResult] =
    React.useState<ImageAnalysisResponse | null>(null);

  const [sweepForm, setSweepForm] = React.useState(INITIAL_SWEEP_FORM);
  const [sweepLoading, setSweepLoading] = React.useState(false);
  const [sweepError, setSweepError] = React.useState<string | null>(null);
  const [sweepResult, setSweepResult] =
    React.useState<TargetSweepResponse | null>(null);

  const queryPreview = React.useMemo(
    () =>
      buildSearchQuery({
        operators: {
          site: queryForm.site,
          inurl: queryForm.inurl,
          intitle: queryForm.intitle,
          intext: queryForm.intext,
          filetype: queryForm.filetype,
          before: queryForm.before,
          after: queryForm.after,
        },
        freeText: queryForm.freeText,
      }),
    [queryForm],
  );

  const totalVisibleResults =
    (queryResult?.items.length ?? 0) +
    (queryResult?.followUpQueries?.reduce(
      (sum, item) => sum + item.results.length,
      0,
    ) ?? 0) +
    (batchResult?.findings.length ?? 0) +
    (imageResult?.relatedResults?.reduce(
      (sum, item) => sum + item.items.length,
      0,
    ) ?? 0) +
    (sweepResult?.sections.reduce(
      (sum, section) => sum + section.results.length,
      0,
    ) ?? 0);

  const totalRecoveredIdentifiers = imageResult?.vision.identifiers.length ?? 0;
  const totalExecutedQueries =
    (queryResult?.followUpQueries?.length ?? 0) +
    (batchResult?.executedQueries.length ?? 0) +
    (imageResult?.generatedQueries.length ?? 0) +
    (sweepResult?.sections.length ?? 0) +
    (queryResult ? 1 : 0);

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const response = await fetch("/api/history", { cache: "no-store" });
      const data = await parseApiResponse<{ items: SessionHistoryItem[] }>(
        response,
      );
      setHistory(data.items ?? []);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Unable to load history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleRunStructuredQuery(event: React.FormEvent) {
    event.preventDefault();
    setQueryLoading(true);
    setQueryError(null);

    try {
      const response = await fetch("/api/search/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...queryForm,
          exactTerms: queryForm.exactTerms
            .split(/[,|\n]/g)
            .map((value) => value.trim())
            .filter(Boolean),
          excludeTerms: queryForm.excludeTerms
            .split(/[,|\n]/g)
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });

      const data = await parseApiResponse<SearchQueryResponse>(response);
      setQueryResult(data);
      void loadHistory();
    } catch (error) {
      setQueryError(
        error instanceof Error ? error.message : "Query execution failed.",
      );
    } finally {
      setQueryLoading(false);
    }
  }

  async function handleRunBatchScan(event: React.FormEvent) {
    event.preventDefault();
    setBatchLoading(true);
    setBatchError(null);
    setBatchProgress(8);

    const interval = window.setInterval(() => {
      setBatchProgress((current) =>
        current >= 92 ? current : current + Math.random() * 11,
      );
    }, 220);

    try {
      const response = await fetch("/api/search/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: batchForm.target,
          includeConfigFormats: batchForm.includeConfigFormats,
          includeArchiveFormats: batchForm.includeArchiveFormats,
          extensions: batchForm.selectedExtensions,
        }),
      });

      const data = await parseApiResponse<BatchDiscoveryResponse>(response);
      setBatchProgress(100);
      setBatchResult(data);
      void loadHistory();
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : "Batch scan failed.",
      );
    } finally {
      window.clearInterval(interval);
      setTimeout(() => setBatchLoading(false), 120);
    }
  }

  async function handleAnalyzeImage(event: React.FormEvent) {
    event.preventDefault();
    setImageLoading(true);
    setImageError(null);

    try {
      const payload =
        imageForm.sourceType === "url"
          ? {
            sourceType: "url",
            imageUrl: imageForm.imageUrl,
          }
          : {
            sourceType: "upload",
            imageBase64: imageForm.imageBase64,
            filename: imageForm.filename,
          };

      const response = await fetch("/api/image/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse<ImageAnalysisResponse>(response);
      setImageResult(data);
      void loadHistory();
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image analysis failed.",
      );
    } finally {
      setImageLoading(false);
    }
  }

  async function handleRunSweep(event: React.FormEvent) {
    event.preventDefault();
    setSweepLoading(true);
    setSweepError(null);

    try {
      const response = await fetch("/api/target/sweep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target: sweepForm.target,
          type: sweepForm.type,
        }),
      });

      const data = await parseApiResponse<TargetSweepResponse>(response);
      setSweepResult(data);
      void loadHistory();
    } catch (error) {
      setSweepError(
        error instanceof Error ? error.message : "Target sweep failed.",
      );
    } finally {
      setSweepLoading(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = QUERY_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setActiveTab("query-builder");
    setQueryForm((current) => ({
      ...current,
      site: preset.operators.site ?? current.site,
      inurl: preset.operators.inurl ?? current.inurl,
      intitle: preset.operators.intitle ?? current.intitle,
      intext: preset.operators.intext ?? current.intext,
      filetype: preset.operators.filetype ?? current.filetype,
      before: preset.operators.before ?? current.before,
      after: preset.operators.after ?? current.after,
      freeText: preset.freeText ?? current.freeText,
    }));
  }

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

  function exportJson(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv(filename: string, rows: Record<string, unknown>[]) {
    const blob = new Blob([jsonToCsv(rows)], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf(title: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        format: "pdf",
        title,
        payload,
      }),
    });

    if (!response.ok) {
      throw new Error("PDF export failed.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--color-border)] bg-black/40 xl:border-r xl:border-b-0">
          <div className="sticky top-0 space-y-6 p-5">
            <Panel glow>
              <PanelHeader>
                <div>
                  <PanelTitle>GhostDork</PanelTitle>
                  <PanelDescription>
                    Private OSINT research dashboard for authorized educational
                    workflows.
                  </PanelDescription>
                </div>
                <Shield className="mt-1 size-5 text-[var(--color-accent)]" />
              </PanelHeader>
              <PanelContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Counter
                    value={totalVisibleResults}
                    label="Visible Results"
                  />
                  <Counter value={totalExecutedQueries} label="Queries Run" />
                  <Counter value={history.length} label="Sessions" />
                  <Counter
                    value={totalRecoveredIdentifiers}
                    label="Identifiers"
                  />
                </div>

                <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-muted-foreground)]">
                    <StatusDot
                      active={
                        queryLoading ||
                        batchLoading ||
                        imageLoading ||
                        sweepLoading
                      }
                    />
                    active modules
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {(
                      [
                        ["Structured Query", queryLoading],
                        ["Document Scan", batchLoading],
                        ["Image AI", imageLoading],
                        ["Target Sweep", sweepLoading],
                      ] as Array<[string, boolean]>
                    ).map(([label, state]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[var(--color-muted-foreground)]">
                          {label}
                        </span>
                        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
                          <StatusDot active={Boolean(state)} />
                          {state ? "running" : "idle"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PanelContent>
            </Panel>

            <Panel inset>
              <PanelHeader>
                <div>
                  <PanelTitle>Quick Target Pivot</PanelTitle>
                  <PanelDescription>
                    Jump straight into a coordinated sweep from the sidebar.
                  </PanelDescription>
                </div>
                <Radar className="size-4 text-[var(--color-accent)]" />
              </PanelHeader>
              <PanelContent className="space-y-3">
                <Input
                  value={sweepForm.target}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSweepForm((current) => ({
                      ...current,
                      target: value,
                      type: inferSweepType(value),
                    }));
                  }}
                  placeholder="name, email, username, domain"
                />
                <Button
                  className="w-full"
                  glow
                  onClick={() =>
                    void handleRunSweep(
                      new Event("submit") as unknown as React.FormEvent,
                    )
                  }
                  disabled={sweepLoading || !sweepForm.target.trim()}
                >
                  <Zap className="size-4" />
                  Run Sweep
                </Button>
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Session History</PanelTitle>
                  <PanelDescription>
                    Redis-backed session replay and cached activity stream.
                  </PanelDescription>
                </div>
                <TerminalSquare className="size-4 text-[var(--color-accent)]" />
              </PanelHeader>
              <PanelContent className="space-y-3">
                {historyLoading ? (
                  <LoadingSkeleton rows={4} />
                ) : historyError ? (
                  <div className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {historyError}
                  </div>
                ) : history.length ? (
                  history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-[var(--color-accent)]/40 hover:bg-black/30"
                      onClick={() => {
                        if (item.kind === "structured-query")
                          setActiveTab("query-builder");
                        if (item.kind === "batch-discovery")
                          setActiveTab("document-scan");
                        if (item.kind === "image-analysis")
                          setActiveTab("image-ai");
                        if (item.kind === "target-sweep")
                          setActiveTab("target-sweep");
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                            {item.kind.replace(/-/g, " ")}
                          </div>
                          <div className="mt-1 text-sm font-medium text-white">
                            {item.label}
                          </div>
                          {item.summary ? (
                            <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                              {truncate(item.summary, 80)}
                            </div>
                          ) : null}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-foreground)]">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    icon={TerminalSquare}
                    title="No Session History"
                    body="Run your first structured query, document scan, image pipeline, or target sweep to populate replayable history."
                    command="ghostdork --init-session"
                  />
                )}
              </PanelContent>
            </Panel>
          </div>
        </aside>

        <main className="min-w-0 p-5 sm:p-6">
          <div className="space-y-6">
            <Panel glow>
              <PanelHeader className="flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <PanelTitle>Main Console</PanelTitle>
                  <div className="font-mono text-xl uppercase tracking-[0.18em] text-white">
                    <TypewriterText text="GhostDork // OSINT Research Operations Dashboard" />
                  </div>
                  <PanelDescription>
                    Terminal brutalism interface for custom search pivots,
                    public document discovery, image-based identifier
                    extraction, and target-centric reconnaissance.
                  </PanelDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Next.js</Badge>
                  <Badge variant="outline">Google CSE</Badge>

                  <Badge variant="outline">Tesseract OCR</Badge>
                  <Badge variant="outline">Upstash Redis</Badge>
                </div>
              </PanelHeader>
            </Panel>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ResearchTab)}
            >
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="query-builder" fullWidth size="lg">
                  <Search className="size-4" />
                  Query Builder
                </TabsTrigger>
                <TabsTrigger value="document-scan" fullWidth size="lg">
                  <FileSearch className="size-4" />
                  Document Scan
                </TabsTrigger>
                <TabsTrigger value="image-ai" fullWidth size="lg">
                  <Bot className="size-4" />
                  Image AI
                </TabsTrigger>
                <TabsTrigger value="target-sweep" fullWidth size="lg">
                  <Radar className="size-4" />
                  Target Sweep
                </TabsTrigger>
              </TabsList>

              <TabsContent value="query-builder" className="mt-6 space-y-6">
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <Panel>
                    <PanelHeader>
                      <div>
                        <PanelTitle>Structured Query Builder</PanelTitle>
                        <PanelDescription>
                          Construct Google Custom Search queries using standard
                          operators and reusable presets.
                        </PanelDescription>
                      </div>
                      <Search className="size-4 text-[var(--color-accent)]" />
                    </PanelHeader>

                    <PanelContent>
                      <form
                        onSubmit={handleRunStructuredQuery}
                        className="space-y-6"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          {SEARCH_OPERATORS.map((operator) => (
                            <div key={operator.key} className="space-y-2">
                              <SectionLabel
                                label={operator.label}
                                hint={operator.description}
                              />
                              <Input
                                value={queryForm[operator.key]}
                                onChange={(event) =>
                                  setQueryForm((current) => ({
                                    ...current,
                                    [operator.key]: event.target.value,
                                  }))
                                }
                                placeholder={operator.placeholder}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="space-y-2 lg:col-span-2">
                            <SectionLabel
                              label="Free-text query"
                              hint="Manual keywords, quoted phrases, operators, and ad hoc pivots."
                            />
                            <Textarea
                              value={queryForm.freeText}
                              onChange={(event) =>
                                setQueryForm((current) => ({
                                  ...current,
                                  freeText: event.target.value,
                                }))
                              }
                              placeholder='e.g. "incident report" OR "directory" OR "export"'
                            />
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <SectionLabel
                                label="Exact terms"
                                hint="Comma-separated exact phrases."
                              />
                              <Textarea
                                className="min-h-[92px]"
                                value={queryForm.exactTerms}
                                onChange={(event) =>
                                  setQueryForm((current) => ({
                                    ...current,
                                    exactTerms: event.target.value,
                                  }))
                                }
                                placeholder="admin portal, exposed config"
                              />
                            </div>

                            <div className="space-y-2">
                              <SectionLabel
                                label="Exclude terms"
                                hint="Comma-separated exclusions."
                              />
                              <Textarea
                                className="min-h-[92px]"
                                value={queryForm.excludeTerms}
                                onChange={(event) =>
                                  setQueryForm((current) => ({
                                    ...current,
                                    excludeTerms: event.target.value,
                                  }))
                                }
                                placeholder="login, careers, docs"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border border-[var(--color-border)] bg-black/30 p-4">
                          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--color-muted-foreground)]">
                            Query Preview
                          </div>
                          <div className="mt-3 break-words font-mono text-sm leading-7 text-[var(--color-accent)]">
                            {queryPreview || "Awaiting operator input..."}
                          </div>
                        </div>

                        {queryError ? (
                          <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <span>{queryError}</span>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                          <Button type="submit" glow disabled={queryLoading}>
                            <Search className="size-4" />
                            {queryLoading ? "Running Query" : "Execute Query"}
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setQueryForm(INITIAL_QUERY_FORM);
                              setQueryResult(null);
                              setQueryError(null);
                            }}
                          >
                            Reset Builder
                          </Button>

                          {queryResult ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  exportJson(
                                    "ghostdork-query-results.json",
                                    queryResult,
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
                                    "ghostdork-query-results.csv",
                                    queryResult.items.map((item) => ({
                                      title: item.title,
                                      link: item.link,
                                      snippet: item.snippet,
                                      filetype: item.filetype ?? "",
                                      displayLink: item.displayLink ?? "",
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

                  <div className="space-y-6">
                    <Panel>
                      <PanelHeader>
                        <div>
                          <PanelTitle>Preset Templates</PanelTitle>
                          <PanelDescription>
                            Organized by research category for faster pivot
                            construction.
                          </PanelDescription>
                        </div>
                        <Zap className="size-4 text-[var(--color-accent)]" />
                      </PanelHeader>
                      <PanelContent className="space-y-5">
                        {QUERY_PRESET_CATEGORIES.map((category) => {
                          const presets = QUERY_PRESETS.filter(
                            (preset) => preset.category === category.key,
                          );

                          return (
                            <div key={category.key} className="space-y-3">
                              <div>
                                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white">
                                  {category.label}
                                </div>
                                <p className="mt-1 text-xs leading-6 text-[var(--color-muted-foreground)]">
                                  {category.description}
                                </p>
                              </div>

                              <div className="space-y-2">
                                {presets.map((preset) => (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => applyPreset(preset.id)}
                                    className="w-full border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-colors hover:border-[var(--color-accent)]/40 hover:bg-black/30"
                                  >
                                    <div className="font-medium text-white">
                                      {preset.name}
                                    </div>
                                    <div className="mt-1 text-xs leading-6 text-[var(--color-muted-foreground)]">
                                      {preset.description}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {preset.tags.map((tag) => (
                                        <Badge key={tag} variant="muted">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </PanelContent>
                    </Panel>

                    <Panel inset>
                      <PanelHeader>
                        <div>
                          <PanelTitle>Operator Notes</PanelTitle>
                          <PanelDescription>
                            Use comma-separated values for repeated operator
                            fragments.
                          </PanelDescription>
                        </div>
                      </PanelHeader>
                      <PanelContent className="space-y-3 text-sm text-[var(--color-muted-foreground)]">
                        <p>
                          Multiple `site`, `inurl`, `intitle`, and `filetype`
                          fragments can be entered as comma-separated values to
                          expand the effective query.
                        </p>
                        <p>
                          Date operators accept values such as{" "}
                          <span className="font-mono text-[var(--color-accent)]">
                            2024-01-01
                          </span>
                          .
                        </p>
                        <p>
                          Use preset templates as starting points, then
                          fine-tune manually for your research hypothesis.
                        </p>
                      </PanelContent>
                    </Panel>
                  </div>
                </div>

                <Panel>
                  <PanelHeader>
                    <div>
                      <PanelTitle>Structured Query Results</PanelTitle>
                      <PanelDescription>
                        Paginated card view showing title, URL, snippet, and
                        filetype context.
                      </PanelDescription>
                    </div>

                    {queryResult ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={queryResult.meta.cached ? "info" : "default"}
                        >
                          {queryResult.meta.cached
                            ? "cache"
                            : queryResult.meta.source}
                        </Badge>
                        <Badge variant="outline">
                          {formatNumber(queryResult.meta.totalResults)} total
                        </Badge>
                      </div>
                    ) : null}
                  </PanelHeader>

                  <PanelContent>
                    {queryLoading ? (
                      <LoadingSkeleton rows={4} />
                    ) : queryResult ? (
                      <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-4">
                          <Counter
                            value={queryResult.items.length}
                            label="Visible Hits"
                          />
                          <Counter
                            value={queryResult.meta.totalResults}
                            label="Total Matches"
                          />
                          <Counter
                            value={queryResult.meta.startIndex}
                            label="Start Index"
                          />
                          <Counter
                            value={queryResult.meta.count}
                            label="Page Size"
                          />
                        </div>

                        {queryResult.followUpQueries?.length ? (
                          <div className="space-y-4">
                            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white">
                              Adaptive Follow-Up Queries
                            </div>

                            {queryResult.followUpQueries.map((followUp) => (
                              <details
                                key={followUp.site}
                                className="group border border-[var(--color-border)] bg-[var(--color-surface)]"
                              >
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4">
                                  <div>
                                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                                      Adaptive Site Pivot // {followUp.site}
                                    </div>
                                    <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                                      Automatically expanded from surfaced domains in the current result set.
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                      {followUp.results.length} visible
                                    </Badge>
                                    <Badge variant="muted">
                                      {formatNumber(followUp.totalResults)} total
                                    </Badge>
                                  </div>
                                </summary>

                                <div className="border-t border-[var(--color-border)] px-4 py-4">
                                  <div className="mb-4 border border-[var(--color-border)] bg-black/30 p-3">
                                    <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                                      Generated Query
                                    </div>
                                    <div className="mt-2 break-words font-mono text-sm text-[var(--color-accent)]">
                                      {followUp.query}
                                    </div>
                                  </div>

                                  {followUp.results.length ? (
                                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                                      {followUp.results.map((item, index) => (
                                        <ResultCard
                                          key={`${followUp.site}-${item.link}-${index}`}
                                          item={item}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="border border-[var(--color-border)] bg-black/20 p-4 text-sm text-[var(--color-muted-foreground)]">
                                      No visible results returned for this adaptive follow-up query.
                                    </div>
                                  )}
                                </div>
                              </details>
                            ))}
                          </div>
                        ) : null}

                        {queryResult.items.length ? (
                          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                            {queryResult.items.map((item, index) => (
                              <ResultCard
                                key={`${item.link}-${index}`}
                                item={item}
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            icon={Search}
                            title="No Results Returned"
                            body="Your structured query executed successfully, but the current result window is empty. Modify operators, broaden filetypes, or remove exclusions."
                            command="refine --query --broaden-scope"
                          />
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Search}
                        title="Awaiting Query Execution"
                        body="Build a structured Google Custom Search query with operators like site, inurl, intitle, intext, and filetype, then execute to populate results."
                        command="ghostdork query --structured --run"
                      />
                    )}
                  </PanelContent>
                </Panel>
              </TabsContent>

              <TabsContent value="document-scan" className="mt-6 space-y-6">
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

                      {batchLoading ? (
                        <div className="space-y-3">
                          <Progress value={batchProgress} showValueLabel />
                          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                            <StatusDot active />
                            batch execution in progress
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="submit"
                          glow
                          disabled={batchLoading || !batchForm.target.trim()}
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
                    {batchLoading ? (
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
              </TabsContent>

              <TabsContent value="image-ai" className="mt-6 space-y-6">
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <Panel>
                    <PanelHeader>
                      <div>
                        <PanelTitle>AI Image Analysis Pipeline</PanelTitle>
                        <PanelDescription>
                          Tesseract OCR → GPT-4o Vision → auto-generated OSINT
                          query expansion.
                        </PanelDescription>
                      </div>
                      <Bot className="size-4 text-[var(--color-accent)]" />
                    </PanelHeader>

                    <PanelContent>
                      <form onSubmit={handleAnalyzeImage} className="space-y-6">
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() =>
                              setImageForm((current) => ({
                                ...current,
                                sourceType: "url",
                              }))
                            }
                            className={cn(
                              "border p-4 text-left transition-colors",
                              imageForm.sourceType === "url"
                                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                                : "border-[var(--color-border)] bg-[var(--color-surface)]",
                            )}
                          >
                            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                              <ImagePlus className="size-4" />
                              Image URL
                            </div>
                            <div className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                              Analyze a remotely hosted image.
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setImageForm((current) => ({
                                ...current,
                                sourceType: "upload",
                              }))
                            }
                            className={cn(
                              "border p-4 text-left transition-colors",
                              imageForm.sourceType === "upload"
                                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10"
                                : "border-[var(--color-border)] bg-[var(--color-surface)]",
                            )}
                          >
                            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                              <Upload className="size-4" />
                              Base64 Upload
                            </div>
                            <div className="mt-2 text-sm text-[var(--color-muted-foreground)]">
                              Paste a base64 payload from a local artifact.
                            </div>
                          </button>
                        </div>

                        {imageForm.sourceType === "url" ? (
                          <div className="space-y-2">
                            <SectionLabel
                              label="Image URL"
                              hint="Provide an externally reachable image URL for OCR and vision analysis."
                            />
                            <Input
                              value={imageForm.imageUrl}
                              onChange={(event) =>
                                setImageForm((current) => ({
                                  ...current,
                                  imageUrl: event.target.value,
                                }))
                              }
                              placeholder="https://example.com/image.png"
                            />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <SectionLabel
                                label="Filename"
                                hint="Optional local filename label for the artifact."
                              />
                              <Input
                                value={imageForm.filename}
                                onChange={(event) =>
                                  setImageForm((current) => ({
                                    ...current,
                                    filename: event.target.value,
                                  }))
                                }
                                placeholder="screenshot.png"
                              />
                            </div>

                            <div className="space-y-2">
                              <SectionLabel
                                label="Base64 image payload"
                                hint="Paste either raw base64 or a full data URL."
                              />
                              <Textarea
                                value={imageForm.imageBase64}
                                onChange={(event) =>
                                  setImageForm((current) => ({
                                    ...current,
                                    imageBase64: event.target.value,
                                  }))
                                }
                                placeholder="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
                              />
                            </div>
                          </div>
                        )}

                        {imageError ? (
                          <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <span>{imageError}</span>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                          <Button
                            type="submit"
                            glow
                            disabled={
                              imageLoading ||
                              (imageForm.sourceType === "url"
                                ? !imageForm.imageUrl.trim()
                                : !imageForm.imageBase64.trim())
                            }
                          >
                            <Bot className="size-4" />
                            {imageLoading ? "Analyzing" : "Run OCR + Vision"}
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setImageForm(INITIAL_IMAGE_FORM);
                              setImageResult(null);
                              setImageError(null);
                            }}
                          >
                            Reset Pipeline
                          </Button>

                          {imageResult ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                exportJson(
                                  "ghostdork-image-analysis.json",
                                  imageResult,
                                )
                              }
                            >
                              <Download className="size-4" />
                              Export JSON
                            </Button>
                          ) : null}
                        </div>
                      </form>
                    </PanelContent>
                  </Panel>

                  <Panel>
                    <PanelHeader>
                      <div>
                        <PanelTitle>Pipeline Output</PanelTitle>
                        <PanelDescription>
                          OCR text, extracted identifiers, and generated
                          follow-up search pivots.
                        </PanelDescription>
                      </div>
                    </PanelHeader>

                    <PanelContent>
                      {imageLoading ? (
                        <LoadingSkeleton rows={5} />
                      ) : imageResult ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <CardTitle>OCR Extraction</CardTitle>
                                <CardDescription>
                                  Raw text captured from the supplied image.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <Counter
                                    value={imageResult.ocr.blocks.length}
                                    label="Text Blocks"
                                  />
                                  <Counter
                                    value={
                                      imageResult.vision.identifiers.length
                                    }
                                    label="Identifiers"
                                  />
                                </div>
                                <div className="max-h-[320px] overflow-auto border border-[var(--color-border)] bg-black/30 p-3 font-mono text-sm leading-7 text-[var(--color-accent)]">
                                  {imageResult.ocr.rawText ||
                                    "No OCR text extracted."}
                                </div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle>Extracted Entities</CardTitle>
                                <CardDescription>
                                  Structured identifiers recovered by the vision
                                  stage.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {imageResult.vision.identifiers.length ? (
                                  imageResult.vision.identifiers.map(
                                    (identifier, index) => (
                                      <div
                                        key={`${identifier.value}-${index}`}
                                        className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <Badge variant="outline">
                                            {identifier.type}
                                          </Badge>
                                          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-foreground)]">
                                            confidence{" "}
                                            {(
                                              identifier.confidence * 100
                                            ).toFixed(0)}
                                            %
                                          </span>
                                        </div>
                                        <div className="mt-3 break-words text-sm text-white">
                                          {identifier.value}
                                        </div>
                                        {identifier.context ? (
                                          <div className="mt-2 text-xs leading-6 text-[var(--color-muted-foreground)]">
                                            {identifier.context}
                                          </div>
                                        ) : null}
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <EmptyState
                                    icon={Bot}
                                    title="No Identifiers Extracted"
                                    body="The pipeline completed, but no structured identifiers were returned from the current image."
                                    command="reanalyze --image --improve-source"
                                  />
                                )}
                              </CardContent>
                            </Card>
                          </div>

                          <div className="space-y-6">
                            <Card>
                              <CardHeader>
                                <CardTitle>Vision Summary</CardTitle>
                                <CardDescription>
                                  Model-assisted interpretation of visible
                                  identifiers and content.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="border border-[var(--color-border)] bg-black/30 p-4 text-sm leading-7 text-[var(--color-muted-foreground)]">
                                  {imageResult.vision.summary}
                                </div>
                                {imageResult.vision.model ? (
                                  <Badge variant="info">
                                    {imageResult.vision.model}
                                  </Badge>
                                ) : (
                                  <Badge variant="warning">
                                    ocr-only fallback
                                  </Badge>
                                )}
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle>Generated Queries</CardTitle>
                                <CardDescription>
                                  Auto-formatted follow-up searches generated
                                  from recovered identifiers.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {imageResult.generatedQueries.length ? (
                                  imageResult.generatedQueries.map(
                                    (entry, index) => (
                                      <div
                                        key={`${entry.query}-${index}`}
                                        className="border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge variant="outline">
                                            {entry.identifierType}
                                          </Badge>
                                          <span className="text-xs text-[var(--color-muted-foreground)]">
                                            {entry.identifier}
                                          </span>
                                        </div>
                                        <div className="mt-3 font-mono text-sm leading-7 text-[var(--color-accent)]">
                                          {entry.query}
                                        </div>
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted-foreground)]">
                                    No auto-generated queries were returned.
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader>
                                <CardTitle>Related Query Results</CardTitle>
                                <CardDescription>
                                  Search follow-ups tied to generated image
                                  pivots.
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                {imageResult.relatedResults?.length ? (
                                  imageResult.relatedResults.map(
                                    (result, index) => (
                                      <div
                                        key={`${result.meta.query}-${index}`}
                                        className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                                      >
                                        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-accent)]">
                                          Query {index + 1}
                                        </div>
                                        <div className="mt-2 break-words font-mono text-sm text-white">
                                          {result.meta.query}
                                        </div>
                                        <div className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                                          {result.items.length} visible results
                                        </div>
                                      </div>
                                    ),
                                  )
                                ) : (
                                  <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted-foreground)]">
                                    No related search results were returned or
                                    search is not configured.
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={ImagePlus}
                          title="Image Pipeline Idle"
                          body="Upload or reference an image to run OCR, structured identifier extraction, and automatic follow-up query generation."
                          command="ghostdork image --ocr --vision --pivot"
                        />
                      )}
                    </PanelContent>
                  </Panel>
                </div>
              </TabsContent>

              <TabsContent value="target-sweep" className="mt-6 space-y-6">
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
                            onChange={(event) =>
                              setSweepForm((current) => ({
                                ...current,
                                target: event.target.value,
                              }))
                            }
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
                              ] as SweepType[]
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
                                  sweepResult as unknown as Record<
                                    string,
                                    unknown
                                  >,
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
                        <Badge
                          variant={sweepResult.cached ? "info" : "default"}
                        >
                          {sweepResult.cached
                            ? "cached report"
                            : "fresh report"}
                        </Badge>
                        <Badge variant="outline">{sweepResult.type}</Badge>
                      </div>
                    ) : null}
                  </PanelHeader>

                  <PanelContent>
                    {sweepLoading ? (
                      <LoadingSkeleton rows={4} />
                    ) : sweepResult ? (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4">
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
                          <Counter
                            value={history.length}
                            label="History Records"
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
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}

export default GhostDorkDashboard;
