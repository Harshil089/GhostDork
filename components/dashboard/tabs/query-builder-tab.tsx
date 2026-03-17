import * as React from "react";
import { AlertTriangle, Download, Search, Zap } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

import {
  QUERY_PRESET_CATEGORIES,
  QUERY_PRESETS,
  SEARCH_OPERATORS,
} from "@/lib/data/presets";
import { buildSearchQuery } from "@/lib/query";
import { formatNumber } from "@/lib/utils";

import {
  SectionLabel,
  TypewriterText,
  LoadingSkeleton,
  EmptyState,
  ResultCard,
  ResultCard as SharedResultCard,
  Counter,
  parseApiResponse,
  exportJson,
  exportCsv,
  SearchQueryResponse,
} from "../shared";

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

interface QueryBuilderTabProps {
  onUpdateStats: (
    id: "query",
    stats: { visibleResults: number; executedQueries: number; identifiers: number }
  ) => void;
  onRefreshHistory: () => void;
}

export function QueryBuilderTab({ onUpdateStats, onRefreshHistory }: QueryBuilderTabProps) {
  const [queryForm, setQueryForm] = React.useState(INITIAL_QUERY_FORM);
  const [queryLoading, setQueryLoading] = React.useState(false);
  const [queryError, setQueryError] = React.useState<string | null>(null);
  const [queryResult, setQueryResult] = React.useState<SearchQueryResponse | null>(null);

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

  React.useEffect(() => {
    const visibleResults =
      (queryResult?.items.length ?? 0) +
      (queryResult?.followUpQueries?.reduce(
        (sum, item) => sum + item.results.length,
        0,
      ) ?? 0);
    const executedQueries = queryResult ? 1 + (queryResult.followUpQueries?.length ?? 0) : 0;

    onUpdateStats("query", { visibleResults, executedQueries, identifiers: 0 });
  }, [queryResult, onUpdateStats]);

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
      onRefreshHistory();
    } catch (error) {
      setQueryError(
        error instanceof Error ? error.message : "Query execution failed.",
      );
    } finally {
      setQueryLoading(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = QUERY_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

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

  return (
    <>
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
                      value={queryForm[operator.key as keyof typeof INITIAL_QUERY_FORM]}
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
                              <SharedResultCard
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
                    <SharedResultCard
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
    </>
  );
}
