import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const nodeRequire = createRequire(import.meta.url);

export type ImageSource =
  | { type: "url"; value: string }
  | { type: "base64"; value: string }
  | { type: "buffer"; value: Buffer };

export interface LoadedImage {
  source: string | Buffer;
  mimeType: string;
  dataUrl?: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  lines: string[];
  words: string[];
}

const DATA_URL_PATTERN = /^data:(.+?);base64,(.+)$/i;

function normalizeResolvedModulePath(resolvedPath: string): string {
  const withoutBundlerSuffix = resolvedPath.split(" [")[0].trim();

  if (withoutBundlerSuffix.startsWith("[project]/")) {
    return path.join(process.cwd(), withoutBundlerSuffix.slice("[project]/".length));
  }

  if (withoutBundlerSuffix.startsWith("/ROOT/")) {
    return path.join(process.cwd(), withoutBundlerSuffix.slice("/ROOT/".length));
  }

  return withoutBundlerSuffix;
}

function resolveTesseractWorkerPath(): string | undefined {
  try {
    const resolved = nodeRequire.resolve(
      "tesseract.js/src/worker-script/node/index.js",
    );
    const normalized = normalizeResolvedModulePath(resolved);

    if (path.isAbsolute(normalized) && fs.existsSync(normalized)) {
      return normalized;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

function resolveTesseractCorePath(): string | undefined {
  try {
    const resolved = nodeRequire.resolve(
      "tesseract.js-core/tesseract-core-simd.wasm.js",
    );
    const normalized = normalizeResolvedModulePath(resolved);

    if (path.isAbsolute(normalized) && fs.existsSync(normalized)) {
      return normalized;
    }
  } catch {
    // Fallback to non-simd core below.
  }

  try {
    const resolved = nodeRequire.resolve(
      "tesseract.js-core/tesseract-core.wasm.js",
    );
    const normalized = normalizeResolvedModulePath(resolved);

    if (path.isAbsolute(normalized) && fs.existsSync(normalized)) {
      return normalized;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function isDataUrl(value: string): boolean {
  return DATA_URL_PATTERN.test(value);
}

export function inferMimeTypeFromUrl(url: string): string {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".gif")) return "image/gif";
  if (pathname.endsWith(".bmp")) return "image/bmp";
  if (pathname.endsWith(".tiff") || pathname.endsWith(".tif")) return "image/tiff";

  return "image/png";
}

export function normalizeBase64Image(input: string): LoadedImage {
  const trimmed = input.trim();
  const match = trimmed.match(DATA_URL_PATTERN);

  if (match) {
    const [, mimeType] = match;
    return {
      source: trimmed,
      mimeType,
      dataUrl: trimmed,
    };
  }

  const mimeType = "image/png";
  const dataUrl = `data:${mimeType};base64,${trimmed}`;

  return {
    source: dataUrl,
    mimeType,
    dataUrl,
  };
}

export async function loadImageFromUrl(url: string): Promise<LoadedImage> {
  let response = await fetch(url, {
    method: "GET",
  });

  // Some hosts block default server fetch signatures and require browser-like headers.
  if (response.status === 401 || response.status === 403) {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
      },
    });
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Failed to fetch image: 403 HTTP Forbidden. The remote host blocked server-side access; use a publicly accessible direct image URL or upload as base64.",
      );
    }

    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const mimeType = contentType || inferMimeTypeFromUrl(url);

  return {
    source: buffer,
    mimeType,
  };
}

export async function loadImage(source: ImageSource): Promise<LoadedImage> {
  switch (source.type) {
    case "url":
      return loadImageFromUrl(source.value);
    case "base64":
      return normalizeBase64Image(source.value);
    case "buffer":
      return {
        source: source.value,
        mimeType: "image/png",
      };
    default: {
      const exhaustiveCheck: never = source;
      throw new Error(`Unsupported image source: ${String(exhaustiveCheck)}`);
    }
  }
}

export async function extractTextWithOcr(image: LoadedImage): Promise<OcrResult> {
  const fallback: OcrResult = {
    text: "",
    confidence: 0,
    lines: [],
    words: [],
  };

  const workerPath = resolveTesseractWorkerPath();
  const corePath = resolveTesseractCorePath();

  if (!workerPath) {
    console.warn("Tesseract worker script not found in runtime bundle. Skipping OCR.");
    return fallback;
  }

  try {
    const tesseractModule = await import("tesseract.js");
    const Tesseract = tesseractModule.default;
    const { data } = await Tesseract.recognize(image.source, "eng", {
      logger: () => undefined,
      workerPath,
      ...(corePath ? { corePath } : {}),
    });

    const text = data.text.trim();
    const lines = (data as any).lines
      .map((line: any) => line.text.trim())
      .filter(Boolean);
    const words = (data as any).words
      .map((word: any) => word.text.trim())
      .filter(Boolean);

    return {
      text,
      confidence: data.confidence,
      lines,
      words,
    };
  } catch (error) {
    console.error("Tesseract OCR failed. Falling back to empty OCR result.", error);
    return fallback;
  }
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const loaded = await loadImageFromUrl(url);

  if (typeof loaded.source === "string") {
    return loaded.source;
  }

  return `data:${loaded.mimeType};base64,${loaded.source.toString("base64")}`;
}
