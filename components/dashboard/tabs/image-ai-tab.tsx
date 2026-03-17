import * as React from "react";
import { AlertTriangle, Bot, Download, ImagePlus, Upload } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";

import {
  SectionLabel,
  LoadingSkeleton,
  EmptyState,
  Counter,
  parseApiResponse,
  exportJson,
  ImageAnalysisResponse,
} from "../shared";

const INITIAL_IMAGE_FORM = {
  imageUrl: "",
  imageBase64: "",
  filename: "",
  sourceType: "url" as "upload" | "url",
};

interface ImageAITabProps {
  onUpdateStats: (
    id: "image",
    stats: { visibleResults: number; executedQueries: number; identifiers: number }
  ) => void;
  onRefreshHistory: () => void;
}

export function ImageAiTab({ onUpdateStats, onRefreshHistory }: ImageAITabProps) {
  const [imageForm, setImageForm] = React.useState(INITIAL_IMAGE_FORM);
  const [imageLoading, setImageLoading] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [imageResult, setImageResult] = React.useState<ImageAnalysisResponse | null>(null);

  React.useEffect(() => {
    const visibleResults = imageResult?.relatedResults?.reduce(
      (sum, item) => sum + item.items.length,
      0,
    ) ?? 0;
    const executedQueries = imageResult?.generatedQueries.length ?? 0;
    const identifiers = imageResult?.vision.identifiers.length ?? 0;

    onUpdateStats("image", { visibleResults, executedQueries, identifiers });
  }, [imageResult, onUpdateStats]);

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
      onRefreshHistory();
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Image analysis failed.",
      );
    } finally {
      setImageLoading(false);
    }
  }

  return (
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
                        value={imageResult.vision.identifiers.length}
                        label="Identifiers"
                      />
                    </div>
                    <div className="max-h-[320px] overflow-auto border border-[var(--color-border)] bg-black/30 p-3 font-mono text-sm leading-7 text-[var(--color-accent)]">
                      {imageResult.ocr.rawText || "No OCR text extracted."}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Extracted Entities</CardTitle>
                    <CardDescription>
                      Structured identifiers recovered by the vision stage.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {imageResult.vision.identifiers.length ? (
                      imageResult.vision.identifiers.map((identifier, index) => (
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
                              {(identifier.confidence * 100).toFixed(0)}%
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
                      ))
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
                      imageResult.generatedQueries.map((entry, index) => (
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
                      ))
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
                      Search follow-ups tied to generated image pivots.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {imageResult.serpApiRestricted ? (
                      <div className="border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                        {imageResult.serpApiRestrictionReason ||
                          "Related search results are disabled by current SerpAPI access policy."}
                      </div>
                    ) : null}
                    {imageResult.relatedResults?.length ? (
                      imageResult.relatedResults.map((result, index) => (
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
                      ))
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
  );
}
