/**
 * Renders a ReportDocument as a PDF.
 *
 * A layout engine and nothing more. It receives a finished document from
 * buildReportDocument() and draws it, so it has no access to the assessment
 * and no way to produce a figure of its own.
 *
 * pdf-lib is imported dynamically because it is by far the largest dependency
 * in the project and most of the journey never needs it. Loading it on demand
 * keeps the initial page, the part everyone pays for, small.
 */

import type { DocumentBlock, DocumentField, ReportDocument } from './reportDocument';

/** A4 at 72dpi, the default pdf-lib page size. */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LABEL_WIDTH = CONTENT_WIDTH * 0.52;

const COLOURS = {
  ink: rgbHex(0x1a, 0x23, 0x32),
  muted: rgbHex(0x5b, 0x67, 0x7a),
  brand: rgbHex(0x0b, 0x1c, 0x33),
  accent: rgbHex(0x1d, 0x5b, 0x9a),
  rule: rgbHex(0xd8, 0xde, 0xe6),
  calloutBg: rgbHex(0xf2, 0xf5, 0xf9),
};

function rgbHex(r: number, g: number, b: number): [number, number, number] {
  return [r / 255, g / 255, b / 255];
}

/**
 * The standard PDF fonts are WinAnsi encoded, so characters outside that set
 * throw when drawn. formatCurrency deliberately uses non-breaking spaces, and
 * the copy contains typographic punctuation, so both are normalised here
 * rather than compromising how text looks on screen.
 */
function sanitise(text: string): string {
  return text
    .replace(/ /g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E\n]/g, '');
}

export async function renderReportPdf(document: ReportDocument): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Just Wiser assessment ${document.reference}`);
  pdf.setAuthor('Just Wiser');
  pdf.setSubject('Buy vs rent decision-support report');
  pdf.setCreator('Just Wiser');

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const colour = (c: [number, number, number]) => rgb(c[0], c[1], c[2]);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = (): void => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  };

  /** Reserves vertical space, starting a page when the block will not fit. */
  const reserve = (height: number): void => {
    if (y - height < MARGIN + 28) newPage();
  };

  const wrap = (text: string, font: typeof regular, size: number, width: number): string[] => {
    const lines: string[] = [];
    for (const paragraph of sanitise(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  };

  const drawText = (
    text: string,
    options: {
      font?: typeof regular;
      size?: number;
      colour?: [number, number, number];
      width?: number;
      x?: number;
      lineHeight?: number;
    } = {},
  ): void => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const width = options.width ?? CONTENT_WIDTH;
    const x = options.x ?? MARGIN;
    const lineHeight = options.lineHeight ?? size * 1.42;

    for (const line of wrap(text, font, size, width)) {
      reserve(lineHeight);
      page.drawText(line, {
        x,
        y: y - size,
        size,
        font,
        color: colour(options.colour ?? COLOURS.ink),
      });
      y -= lineHeight;
    }
  };

  // --- Cover header -------------------------------------------------------
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 132,
    width: PAGE_WIDTH,
    height: 132,
    color: colour(COLOURS.brand),
  });

  page.drawText(sanitise(document.title), {
    x: MARGIN,
    y: PAGE_HEIGHT - 70,
    size: 26,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(sanitise(document.tagline), {
    x: MARGIN,
    y: PAGE_HEIGHT - 92,
    size: 10.5,
    font: regular,
    color: rgb(0.78, 0.84, 0.92),
  });
  page.drawText(sanitise('Buy vs rent decision-support report'), {
    x: MARGIN,
    y: PAGE_HEIGHT - 114,
    size: 9.5,
    font: regular,
    color: rgb(0.68, 0.76, 0.87),
  });

  y = PAGE_HEIGHT - 132 - 26;

  // Reference and date, on one line.
  const metaLine = `Assessment reference ${document.reference}    |    Generated ${document.generatedAt}`;
  drawText(metaLine, { size: 9.5, colour: COLOURS.muted });
  y -= 10;

  // Headline result.
  drawText(document.headline, { font: bold, size: 17, colour: COLOURS.brand });
  y -= 6;

  for (const section of document.sections) {
    y -= 16;
    reserve(52);

    page.drawLine({
      start: { x: MARGIN, y: y + 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
      thickness: 0.75,
      color: colour(COLOURS.rule),
    });
    y -= 8;

    drawText(section.title, { font: bold, size: 13, colour: COLOURS.brand });

    if (section.lede) {
      y -= 2;
      drawText(section.lede, { size: 9, colour: COLOURS.muted });
    }

    y -= 4;

    for (const block of section.blocks) {
      drawBlock(block);
      y -= 8;
    }
  }

  // --- Disclaimer ---------------------------------------------------------
  y -= 14;
  reserve(60);
  page.drawLine({
    start: { x: MARGIN, y: y + 6 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 6 },
    thickness: 0.75,
    color: colour(COLOURS.rule),
  });
  y -= 10;
  drawText(document.disclaimer, { size: 8.5, colour: COLOURS.muted });

  addPageNumbers();

  return pdf.save();

  // --- Block renderers ----------------------------------------------------

  function drawBlock(block: DocumentBlock): void {
    switch (block.kind) {
      case 'paragraph':
        drawText(block.text, { size: 10 });
        return;

      case 'bullets':
        for (const item of block.items) {
          const lines = wrap(item, regular, 10, CONTENT_WIDTH - 14);
          reserve(lines.length * 14.2);
          page.drawCircle({
            x: MARGIN + 3,
            y: y - 6.5,
            size: 1.8,
            color: colour(COLOURS.accent),
          });
          drawText(item, { size: 10, x: MARGIN + 14, width: CONTENT_WIDTH - 14 });
          y -= 3;
        }
        return;

      case 'fields':
        for (const field of block.fields) drawField(field);
        return;

      case 'table':
        drawTable(block.columns, block.rows);
        return;

      case 'callout':
        drawCallout(block.title, block.text);
        return;
    }
  }

  function drawField(field: DocumentField): void {
    const labelLines = wrap(field.label, regular, 10, LABEL_WIDTH - 8);
    const valueLines = wrap(field.value, bold, 10, CONTENT_WIDTH - LABEL_WIDTH);
    const rowHeight = Math.max(labelLines.length, valueLines.length) * 14.2;

    reserve(rowHeight + (field.note ? 24 : 0));

    const top = y;
    for (let i = 0; i < labelLines.length; i++) {
      page.drawText(labelLines[i], {
        x: MARGIN,
        y: top - 10 - i * 14.2,
        size: 10,
        font: regular,
        color: colour(COLOURS.ink),
      });
    }
    for (let i = 0; i < valueLines.length; i++) {
      page.drawText(valueLines[i], {
        x: MARGIN + LABEL_WIDTH,
        y: top - 10 - i * 14.2,
        size: 10,
        font: bold,
        color: colour(COLOURS.brand),
      });
    }
    y = top - rowHeight;

    if (field.note) {
      drawText(field.note, { size: 8.5, colour: COLOURS.muted, x: MARGIN, width: CONTENT_WIDTH });
    }
    y -= 3;
  }

  function drawTable(columns: string[], rows: string[][]): void {
    const columnWidth = CONTENT_WIDTH / columns.length;
    reserve(24 + rows.length * 20);

    // Header row.
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: CONTENT_WIDTH,
      height: 20,
      color: colour(COLOURS.calloutBg),
    });
    columns.forEach((column, index) => {
      page.drawText(sanitise(column), {
        x: MARGIN + 8 + index * columnWidth,
        y: y - 13,
        size: 9,
        font: bold,
        color: colour(COLOURS.brand),
      });
    });
    y -= 22;

    for (const row of rows) {
      reserve(20);
      row.forEach((cell, index) => {
        page.drawText(sanitise(cell), {
          x: MARGIN + 8 + index * columnWidth,
          y: y - 12,
          size: 9.5,
          font: regular,
          color: colour(COLOURS.ink),
        });
      });
      y -= 18;
      page.drawLine({
        start: { x: MARGIN, y: y + 2 },
        end: { x: PAGE_WIDTH - MARGIN, y: y + 2 },
        thickness: 0.5,
        color: colour(COLOURS.rule),
      });
    }
    y -= 4;
  }

  function drawCallout(title: string, text: string): void {
    const titleLines = wrap(title, bold, 11, CONTENT_WIDTH - 24);
    const bodyLines = wrap(text, regular, 10, CONTENT_WIDTH - 24);
    const height = 18 + titleLines.length * 15 + bodyLines.length * 14.2;

    reserve(height + 8);

    page.drawRectangle({
      x: MARGIN,
      y: y - height,
      width: CONTENT_WIDTH,
      height,
      color: colour(COLOURS.calloutBg),
    });
    page.drawRectangle({
      x: MARGIN,
      y: y - height,
      width: 3,
      height,
      color: colour(COLOURS.accent),
    });

    let cursor = y - 14;
    for (const line of titleLines) {
      page.drawText(line, {
        x: MARGIN + 14,
        y: cursor,
        size: 11,
        font: bold,
        color: colour(COLOURS.brand),
      });
      cursor -= 15;
    }
    for (const line of bodyLines) {
      page.drawText(line, {
        x: MARGIN + 14,
        y: cursor,
        size: 10,
        font: regular,
        color: colour(COLOURS.ink),
      });
      cursor -= 14.2;
    }

    y -= height + 4;
  }

  function addPageNumbers(): void {
    const pages = pdf.getPages();
    pages.forEach((current, index) => {
      const label = `Just Wiser  |  Reference ${document.reference}  |  Page ${index + 1} of ${pages.length}`;
      current.drawText(sanitise(label), {
        x: MARGIN,
        y: MARGIN - 24,
        size: 8,
        font: regular,
        color: colour(COLOURS.muted),
      });
    });
  }
}

/** Builds the filename a customer sees when the PDF downloads. */
export function pdfFilename(reference: string): string {
  return `just-wiser-report-${reference}.pdf`;
}
