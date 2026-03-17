import * as React from "react";
import { ExternalLink, TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FILE_FORMAT_LOOKUP } from "@/lib/data/presets";
import { cn, formatNumber, truncate } from "@/lib/utils";

export type ResearchTab = "query-builder" | "document-scan" | "image-ai" | "target-sweep";
export type SweepType = "name" | "email" | "username" | "domain";

export type SearchResultItem = {
  title: string;
  link: string;
  snippet: string;
  displayLink?: string;
  filetype?: string;
};

export type SearchQueryResponse = {
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
  aiExpansion?: {
    rounds: number;
    minScore: number;
    requestBudget: number;
    sessionBudget?: number;
    sessionRemaining?: number;
    generatedQueries: string[];
    executedQueries: Array<{
      site: string;
      query: string;
      results: SearchResultItem[];
      totalResults: number;
    }>;
    skippedQueries?: Array<{
      query: string;
      score?: number;
      reason: string;
    }>;
  };
};

export type BatchFinding = SearchResultItem & {
  extension: string;
  category: string;
  query: string;
};

export type BatchDiscoveryResponse = {
  target: string;
  progress: {
    completed: number;
    total: number;
    status: "idle" | "running" | "complete" | "error";
  };
  findings: BatchFinding[];
  executedQueries: string[];
  cached: boolean;
  serpApiRestricted?: boolean;
  serpApiRestrictionReason?: string;
  generatedAt: string;
};

export type ImageIdentifier = {
  type: string;
  value: string;
  confidence: number;
  context?: string;
};

export type ImageAnalysisResponse = {
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
  serpApiRestricted?: boolean;
  serpApiRestrictionReason?: string;
  generatedAt: string;
};

export type SweepSection = {
  id: string;
  label: string;
  description: string;
  query: string;
  results: SearchResultItem[];
  totalResults: number;
};

export type TargetSweepResponse = {
  target: string;
  type: SweepType;
  sections: SweepSection[];
  cached: boolean;
  generatedAt: string;
};

export type SessionHistoryItem = {
  id: string;
  label: string;
  kind: "structured-query" | "batch-discovery" | "image-analysis" | "target-sweep";
  summary?: string;
  createdAt: string;
  input: Record<string, unknown>;
};

export type ApiError = {
  error: string;
  details?: string;
};

export function TypewriterText({
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

export function StatusDot({
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

export function SectionLabel({ label, hint }: { label: string; hint?: string }) {
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

export function Counter({ value, label }: { value: number; label: string }) {
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

export function ResultCard({ item }: { item: SearchResultItem }) {
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

export function FindingsTable({ findings }: { findings: BatchFinding[] }) {
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

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
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

export function EmptyState({
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

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const err = data as ApiError;
    throw new Error(err.details || err.error || "Request failed.");
  }

  return data as T;
}

export function exportJson(filename: string, payload: unknown) {
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

export function exportCsv(filename: string, rows: Record<string, unknown>[]) {
  const { jsonToCsv } = require("@/lib/utils");
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

export async function exportPdf(title: string, payload: Record<string, unknown>) {
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
