import fs from "node:fs";
import { createRequire } from "node:module";
import dns from "node:dns/promises";
import net from "node:net";
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
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_FETCH_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_FETCH_MAX_REDIRECTS = 3;

function ipToInt(ip: string): number {
  return ip
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function isIpv4InCidr(ip: string, base: string, maskBits: number): boolean {
  const value = ipToInt(ip);
  const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0);
  return (value & mask) === (ipToInt(base) & mask);
}

function isBlockedIpAddress(ip: string): boolean {
  const ipType = net.isIP(ip);

  if (ipType === 4) {
    return (
      isIpv4InCidr(ip, "0.0.0.0", 8) ||
      isIpv4InCidr(ip, "10.0.0.0", 8) ||
      isIpv4InCidr(ip, "100.64.0.0", 10) ||
      isIpv4InCidr(ip, "127.0.0.0", 8) ||
      isIpv4InCidr(ip, "169.254.0.0", 16) ||
      isIpv4InCidr(ip, "172.16.0.0", 12) ||
      isIpv4InCidr(ip, "192.0.0.0", 24) ||
      isIpv4InCidr(ip, "192.0.2.0", 24) ||
      isIpv4InCidr(ip, "192.168.0.0", 16) ||
      isIpv4InCidr(ip, "198.18.0.0", 15) ||
      isIpv4InCidr(ip, "198.51.100.0", 24) ||
      isIpv4InCidr(ip, "203.0.113.0", 24) ||
      isIpv4InCidr(ip, "224.0.0.0", 4) ||
      isIpv4InCidr(ip, "240.0.0.0", 4)
    );
  }

  if (ipType === 6) {
    const normalized = ip.toLowerCase();

    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff")
    );
  }

  return true;
}

function validateUrlProtocol(url: URL): void {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error("Only http and https image URLs are allowed.");
  }

  if (!url.hostname) {
    throw new Error("Image URL must include a hostname.");
  }

  const lowerHost = url.hostname.toLowerCase();
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".local")
  ) {
    throw new Error("Local network hosts are not allowed for image fetch.");
  }
}

async function assertPublicResolvableHost(url: URL): Promise<void> {
  validateUrlProtocol(url);
  const host = url.hostname;

  if (net.isIP(host)) {
    if (isBlockedIpAddress(host)) {
      throw new Error("Blocked non-public destination for image URL.");
    }

    return;
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = (await dns.lookup(host, {
      all: true,
      verbatim: true,
    })) as Array<{ address: string; family: number }>;
  } catch {
    throw new Error("Unable to resolve image URL hostname.");
  }

  if (!records.length) {
    throw new Error("Image URL hostname did not resolve to an address.");
  }

  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      throw new Error("Blocked non-public destination for image URL.");
    }
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      redirect: "manual",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error("Image fetch timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readImageBodyWithLimit(response: Response): Promise<Buffer> {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "0",
    10,
  );

  if (Number.isFinite(contentLength) && contentLength > IMAGE_FETCH_MAX_BYTES) {
    throw new Error("Image file too large.");
  }

  if (!response.body) {
    throw new Error("Image response body is empty.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    total += value.byteLength;
    if (total > IMAGE_FETCH_MAX_BYTES) {
      throw new Error("Image file too large.");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

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
  let currentUrl = new URL(url);
  await assertPublicResolvableHost(currentUrl);

  let response: Response | null = null;

  for (let redirects = 0; redirects <= IMAGE_FETCH_MAX_REDIRECTS; redirects += 1) {
    response = await fetchWithTimeout(currentUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Image fetch redirect missing location header.");
      }

      currentUrl = new URL(location, currentUrl);
      await assertPublicResolvableHost(currentUrl);
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error("Failed to fetch image.");
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error("Too many redirects while fetching image.");
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Remote URL did not return an image content-type.");
  }

  const buffer = await readImageBodyWithLimit(response);
  const mimeType = contentType || inferMimeTypeFromUrl(currentUrl.toString());

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
