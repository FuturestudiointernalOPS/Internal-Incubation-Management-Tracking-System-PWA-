import { jsPDF } from "jspdf";
import {
  BRAND_ORANGE,
  INK,
  MUTED,
  FAINT,
  BORDER,
  LABELS,
  PAGE_MARGIN,
  BODY_STEP,
  sanitize,
} from "./shared";

/**
 * Build the AI-COMPOSED report PDF bytes.
 *
 * The fixed renderer above draws one agreed document. This one draws whatever
 * structure the Run's Output Instruction produced: a title, then sections of
 * headings and paragraph/bullet blocks. Only the layout guarantees are fixed —
 * nothing past the margins, paginate on every page, Latin-1 safe — which is what
 * lets an administrator change the tone and structure of the report without a
 * code change.
 *
 * The document is the STORED composed report, not a live model call, so the
 * previewed document and the sent document are the same bytes.
 *
 * The form's questions and the participant's answers are appended after it,
 * always, from the stored answers — the platform owns that section.
 *
 * @param {object} data
 * @param {string} data.lang                      "en" | "fr"
 * @param {string} [data.applicantName]
 * @param {string} [data.submittedAt]             ISO date
 * @param {{title?: string|null, sections: Array<{heading?: string|null, blocks: Array<{type: string, text: string}>}>}} data.document
 * @param {Array<{title?: string, items: Array<{label: string, value: string}>}>} [data.sections]
 *        the form's questions and the participant's answers, appended LAST as
 *        the evidence the report was written from
 * @returns {Uint8Array} PDF bytes
 */
export function buildComposedReportPdf(data) {
  const labels = { ...LABELS.en, ...(LABELS[data.lang] || {}) };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentWidth = pageW - PAGE_MARGIN * 2;
  let cursorY = PAGE_MARGIN;

  const text = (value) => sanitize(value);

  const ensure = (needed) => {
    if (cursorY + needed > pageH - PAGE_MARGIN) {
      doc.addPage();
      cursorY = PAGE_MARGIN + 8;
    }
  };

  // Same contract as the fixed renderer: the caller sets the font, size and
  // colour first, because the wrap is measured against those metrics.
  const drawWrapped = ({ value, x = PAGE_MARGIN, width = contentWidth, lineStep = BODY_STEP, gap = 0, prefix = null } = {}) => {
    const lines = doc.splitTextToSize(text(value), width);
    for (let i = 0; i < lines.length; i += 1) {
      if (cursorY + lineStep > pageH - PAGE_MARGIN) {
        doc.addPage();
        cursorY = PAGE_MARGIN + 8;
      }
      if (i === 0 && prefix) doc.text(prefix, PAGE_MARGIN + 2, cursorY);
      doc.text(lines[i], x, cursorY);
      cursorY += lineStep;
    }
    cursorY += gap;
    return lines.length;
  };

  // ─── Header (report title + applicant/date only) ────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  cursorY += 6;
  drawWrapped({ value: data.document?.title || labels.title, lineStep: 24 });

  const idParts = [];
  if (data.applicantName) idParts.push(`${labels.applicant}: ${text(data.applicantName)}`);
  if (data.submittedAt) {
    let date = null;
    try {
      date = new Date(data.submittedAt);
    } catch (_) {}
    if (date && !Number.isNaN(date.getTime())) {
      idParts.push(`${labels.submitted}: ${text(date.toLocaleDateString(data.lang === "fr" ? "fr-FR" : "en-GB", { year: "numeric", month: "long", day: "numeric" }))}`);
    }
  }
  if (idParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...MUTED);
    drawWrapped({ value: idParts.join("   ·   "), lineStep: 16 });
    cursorY += 6;
  } else {
    cursorY += 14;
  }

  // ─── Composed sections ──────────────────────────────────────────────────────
  const drawHeading = (value) => {
    ensure(56);
    cursorY += 10;
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(2);
    doc.line(PAGE_MARGIN, cursorY, PAGE_MARGIN + 38, cursorY);
    cursorY += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    drawWrapped({ value, lineStep: 20, gap: 8 });
  };

  const sections = Array.isArray(data.document?.sections) ? data.document.sections : [];
  for (const section of sections) {
    const heading = typeof section?.heading === "string" ? section.heading.trim() : "";
    if (heading) drawHeading(heading);

    for (const block of Array.isArray(section?.blocks) ? section.blocks : []) {
      const value = typeof block?.text === "string" ? block.text : "";
      if (!value.trim()) continue;
      if (block?.type === "bullet") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        drawWrapped({ value, x: PAGE_MARGIN + 14, width: contentWidth - 20, gap: 7, prefix: "•" });
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(...MUTED);
        drawWrapped({ value, gap: 12 });
      }
    }
    cursorY += 8;
  }

  // ─── The form's questions and the participant's answers ─────────────────────
  // Always LAST, after everything the Output Instruction composed: the report is
  // the READING, this section is the evidence it was written from. The platform
  // draws it itself, from the stored answers — an instruction can therefore
  // neither remove it nor alter an answer.
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    drawHeading(labels.responsesTitle);

    for (const section of data.sections) {
      if (!section.items || section.items.length === 0) continue;
      if (section.title) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND_ORANGE);
        ensure(26);
        cursorY += 6;
        drawWrapped({ value: text(section.title).toUpperCase(), lineStep: 18 });
      }

      for (const item of section.items) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...INK);
        // Question labels are often full sentences: wrap them too.
        const labelLines = doc.splitTextToSize(text(item.label), contentWidth);
        for (let i = 0; i < labelLines.length; i += 1) {
          if (i > 0) cursorY += 15;
          ensure(20);
          doc.text(labelLines[i], PAGE_MARGIN, cursorY + 2);
        }
        cursorY += 18;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        drawWrapped({ value: item.value, gap: 12 });
      }
      cursorY += 12;
    }
    cursorY += 16;
  }

  // ─── Footer (identical to the fixed renderer) ───────────────────────────────
  if (cursorY + 60 < pageH - PAGE_MARGIN) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(PAGE_MARGIN, pageH - 46, pageW - PAGE_MARGIN, pageH - 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...FAINT);
    doc.text(text(labels.thankYou), PAGE_MARGIN, pageH - 32);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_ORANGE);
    doc.text("Impact OS", pageW - PAGE_MARGIN, pageH - 32, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
