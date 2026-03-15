import Tesseract from "tesseract.js";

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
  const response = await fetch(url);

  if (!response.ok) {
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
  const { data } = await Tesseract.recognize(image.source, "eng", {
    logger: () => undefined,
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
}

export async function imageUrlToDataUrl(url: string): Promise<string> {
  const loaded = await loadImageFromUrl(url);

  if (typeof loaded.source === "string") {
    return loaded.source;
  }

  return `data:${loaded.mimeType};base64,${loaded.source.toString("base64")}`;
}
