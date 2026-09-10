/**
 * The customer-facing output.
 *
 * Note the split: buildReportDocument() is pure and testable, renderReportPdf()
 * only draws. downloadReportPdf() is the one function that touches the browser,
 * which keeps everything above it usable in a test.
 */

import type { ReportModel } from '../../models/results';
import { buildReportDocument } from './reportDocument';
import { pdfFilename, renderReportPdf } from './pdf';

export { buildReportDocument, formatTimestamp } from './reportDocument';
export type { ReportDocument, DocumentSection, DocumentBlock, DocumentField } from './reportDocument';
export { renderReportPdf, pdfFilename } from './pdf';

/** Builds the PDF from an existing report and hands it to the browser. */
export async function downloadReportPdf(report: ReportModel): Promise<void> {
  const document = buildReportDocument(report);
  const bytes = await renderReportPdf(document);

  // Copy into a fresh ArrayBuffer so the Blob is not tied to pdf-lib's buffer.
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = pdfFilename(document.reference);
  link.click();
  URL.revokeObjectURL(url);
}
