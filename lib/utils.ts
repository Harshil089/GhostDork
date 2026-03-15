import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dedupeByKey<T>(
  items: T[],
  getKey: (item: T) => string,
): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function truncate(value: string, maxLength = 140) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined) {
    return [];
  }

  return [value];
}

export function compact<T>(items: Array<T | null | undefined | false>) {
  return items.filter(Boolean) as T[];
}

export function jsonToCsv<T extends Record<string, unknown>>(rows: T[]) {
  if (!rows.length) {
    return "";
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const escapeCell = (value: unknown) => {
    const normalized =
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(row[header])).join(","),
    ),
  ];

  return lines.join("\n");
}

export function downloadFilename(prefix: string, extension: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slugify(prefix)}-${stamp}.${extension.replace(/^\./, "")}`;
}
