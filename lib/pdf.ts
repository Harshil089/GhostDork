import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export interface PdfExportOptions {
  title?: string;
  subtitle?: string;
  generatedAt?: string;
  footerText?: string;
  maxDepth?: number;
}

export interface PdfExportResult {
  bytes: Uint8Array;
  filename: string;
}

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
  lineHeight: 14,
  sectionGap: 18,
} as const;

const COLORS = {
  background: rgb(0.04, 0.04, 0.04),
  surface: rgb(0.07, 0.07, 0.07),
  border: rgb(0.12, 0.12, 0.12),
  accent: rgb(0, 1, 0.53),
  text: rgb(0.93, 0.93, 0.93),
  muted: rgb(0.55, 0.55, 0.55),
  danger: rgb(1, 0.2, 0.2),
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createFilename(title: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${slugify(title || "ghostdork-report")}-${stamp}.pdf`;
}

function formatLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stringifyValue(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
) {
  const normalized = text.replace(/\t/g, "  ").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);

    if (width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let partial = "";
    for (const char of word) {
      const next = partial + char;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        partial = next;
      } else {
        if (partial) {
          lines.push(partial);
        }
        partial = char;
      }
    }
    current = partial;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

class PdfWriter {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private mono!: PDFFont;
  private sans!: PDFFont;
  private y = PAGE.height - PAGE.margin;
  private pageNumber = 0;

  async init() {
    this.doc = await PDFDocument.create();
    this.mono = await this.doc.embedFont(StandardFonts.Courier);
    this.sans = await this.doc.embedFont(StandardFonts.Helvetica);
    this.addPage();
  }

  private addPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.pageNumber += 1;
    this.y = PAGE.height - PAGE.margin;

    this.page.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE.width,
      height: PAGE.height,
      color: COLORS.background,
    });

    this.page.drawLine({
      start: { x: PAGE.margin, y: PAGE.height - 28 },
      end: { x: PAGE.width - PAGE.margin, y: PAGE.height - 28 },
      thickness: 1,
      color: COLORS.border,
    });

    this.page.drawText("GHOSTDORK // OSINT RESEARCH DASHBOARD", {
      x: PAGE.margin,
      y: PAGE.height - 20,
      size: 9,
      font: this.mono,
      color: COLORS.accent,
    });

    this.page.drawText(`PAGE ${String(this.pageNumber).padStart(2, "0")}`, {
      x: PAGE.width - PAGE.margin - 64,
      y: PAGE.height - 20,
      size: 9,
      font: this.mono,
      color: COLORS.muted,
    });
  }

  private ensureSpace(lines = 1, fontSize = 12) {
    const needed = lines * (fontSize + 3) + 24;
    if (this.y - needed < PAGE.margin) {
      this.addPage();
    }
  }

  line(
    text: string,
    options?: {
      size?: number;
      color?: ReturnType<typeof rgb>;
      font?: "mono" | "sans";
    },
  ) {
    const size = options?.size ?? 11;
    const font = options?.font === "sans" ? this.sans : this.mono;
    const color = options?.color ?? COLORS.text;
    const maxWidth = PAGE.width - PAGE.margin * 2;
    const lines = wrapText(text, font, size, maxWidth);

    this.ensureSpace(lines.length, size);

    for (const line of lines) {
      this.page.drawText(line, {
        x: PAGE.margin,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= size + 3;
    }
  }

  keyValue(key: string, value: string) {
    const label = `${formatLabel(key)}:`;
    const labelWidth = this.mono.widthOfTextAtSize(label, 10);
    const startX = PAGE.margin;
    const valueX = startX + Math.min(labelWidth + 10, 160);
    const maxWidth = PAGE.width - PAGE.margin - valueX;
    const valueLines = wrapText(value, this.sans, 10, maxWidth);

    this.ensureSpace(Math.max(1, valueLines.length), 10);

    this.page.drawText(label, {
      x: startX,
      y: this.y,
      size: 10,
      font: this.mono,
      color: COLORS.accent,
    });

    valueLines.forEach((line, index) => {
      this.page.drawText(line, {
        x: valueX,
        y: this.y - index * 13,
        size: 10,
        font: this.sans,
        color: COLORS.text,
      });
    });

    this.y -= valueLines.length * 13;
  }

  section(title: string) {
    this.y -= 4;
    this.ensureSpace(2, 12);

    this.page.drawRectangle({
      x: PAGE.margin,
      y: this.y - 4,
      width: PAGE.width - PAGE.margin * 2,
      height: 18,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    this.page.drawText(title.toUpperCase(), {
      x: PAGE.margin + 8,
      y: this.y + 1,
      size: 10,
      font: this.mono,
      color: COLORS.accent,
    });

    this.y -= PAGE.sectionGap;
  }

  divider() {
    this.ensureSpace(1, 8);
    this.page.drawLine({
      start: { x: PAGE.margin, y: this.y },
      end: { x: PAGE.width - PAGE.margin, y: this.y },
      thickness: 1,
      color: COLORS.border,
    });
    this.y -= 10;
  }

  bullet(text: string, indent = 0) {
    const bulletX = PAGE.margin + indent * 16;
    const textX = bulletX + 12;
    const maxWidth = PAGE.width - PAGE.margin - textX;
    const lines = wrapText(text, this.sans, 10, maxWidth);

    this.ensureSpace(lines.length, 10);

    this.page.drawText(">", {
      x: bulletX,
      y: this.y,
      size: 10,
      font: this.mono,
      color: COLORS.accent,
    });

    lines.forEach((line, index) => {
      this.page.drawText(line, {
        x: textX,
        y: this.y - index * 13,
        size: 10,
        font: this.sans,
        color: COLORS.text,
      });
    });

    this.y -= lines.length * 13;
  }

  async save() {
    return this.doc.save();
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function renderValue(
  writer: PdfWriter,
  key: string,
  value: JsonValue,
  depth: number,
  maxDepth: number,
) {
  if (depth > maxDepth) {
    writer.keyValue(key, "[max depth reached]");
    return;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    writer.keyValue(key, stringifyValue(value));
    return;
  }

  if (Array.isArray(value)) {
    writer.section(`${formatLabel(key)} [${value.length}]`);

    if (value.length === 0) {
      writer.line("No entries.", {
        size: 10,
        color: COLORS.muted,
        font: "sans",
      });
      return;
    }

    value.forEach((item, index) => {
      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
      ) {
        writer.bullet(stringifyValue(item), 0);
        return;
      }

      if (Array.isArray(item)) {
        writer.bullet(`Nested array #${index + 1}`, 0);
        renderValue(writer, `items_${index + 1}`, item, depth + 1, maxDepth);
        return;
      }

      writer.bullet(`${formatLabel(key)} item ${index + 1}`, 0);
      for (const [childKey, childValue] of Object.entries(item)) {
        renderValue(writer, childKey, childValue, depth + 1, maxDepth);
      }
      writer.divider();
    });

    return;
  }

  writer.section(formatLabel(key));
  const entries = Object.entries(value);

  if (entries.length === 0) {
    writer.line("No fields.", { size: 10, color: COLORS.muted, font: "sans" });
    return;
  }

  for (const [childKey, childValue] of entries) {
    renderValue(writer, childKey, childValue, depth + 1, maxDepth);
  }
}

export async function createPdfReport(
  payload: JsonObject,
  options: PdfExportOptions = {},
): Promise<PdfExportResult> {
  const writer = new PdfWriter();
  await writer.init();

  const title = options.title?.trim() || "GhostDork Research Report";
  const subtitle = options.subtitle?.trim();
  const generatedAt = options.generatedAt || new Date().toISOString();
  const footerText =
    options.footerText?.trim() ||
    "Generated for authorized educational research.";
  const maxDepth = options.maxDepth ?? 5;

  writer.line(title, { size: 18, color: COLORS.text, font: "mono" });

  if (subtitle) {
    writer.line(subtitle, { size: 11, color: COLORS.muted, font: "sans" });
  }

  writer.line(`Generated: ${generatedAt}`, {
    size: 10,
    color: COLORS.accent,
    font: "mono",
  });
  writer.line(footerText, { size: 10, color: COLORS.muted, font: "sans" });
  writer.divider();

  if (!isJsonObject(payload) || Object.keys(payload).length === 0) {
    writer.section("Payload");
    writer.line("No exportable data was provided.", {
      size: 11,
      color: COLORS.danger,
      font: "sans",
    });
  } else {
    for (const [key, value] of Object.entries(payload)) {
      renderValue(writer, key, value, 0, maxDepth);
    }
  }

  const bytes = await writer.save();

  return {
    bytes,
    filename: createFilename(title),
  };
}

export async function createPdfResponse(
  payload: JsonObject,
  options: PdfExportOptions = {},
): Promise<Response> {
  const result = await createPdfReport(payload, options);

  return new Response(result.bytes as any, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
