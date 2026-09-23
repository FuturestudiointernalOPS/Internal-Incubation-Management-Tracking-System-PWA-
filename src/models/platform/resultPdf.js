import { jsPDF } from "jspdf";

/**
 * Submission result PDF (platform form runs).
 *
 * Renders a participant-facing result document server-side from the
 * authoritative records only: the form answers stored on the submission,
 * the latest evaluation (dimensions + overall score) and the last review
 * decision/comment. The document NEVER mentions the form or run names and
 * never mentions how the evaluation was produced — the participant sees
 * only their responses, the evaluation feedback and their final score.
 *
 * Internationalization: the header/footer copy is provided in English and
 * French (the two workflow languages detected from the form). Answers and
 * feedback are rendered verbatim — their language is whatever the applicant
 * and the reviewer wrote.
 */

const BRAND_ORANGE = [255, 102, 0]; // --brand-orange
const INK = [15, 23, 42]; // --text-primary
const MUTED = [100, 116, 139]; // slate-500
const FAINT = [148, 163, 184]; // slate-400
const GREEN = [5, 150, 105]; // emerald-600
const AMBER = [217, 119, 6]; // amber-600
const ROSE = [225, 29, 72]; // rose-700
const LIGHT_BG = [241, 245, 249]; // slate-100
const BORDER = [203, 213, 225]; // slate-300

const LABELS = {
  en: {
    title: "Submission Result",
    applicant: "Applicant",
    submitted: "Submitted",
    finalScore: "Final Score",
    outcome: "Outcome",
    decisionApproved: "Approved",
    decisionRejected: "Not accepted",
    decisionRevision: "Revision requested",
    comment: "Comment",
    evaluationTitle: "Evaluation & Feedback",
    strengths: "Strengths",
    improvements: "Areas for improvement",
    responsesTitle: "Your Responses",
    thankYou: "Thank you for participating.",
  },
  fr: {
    title: "Résultat de votre soumission",
    applicant: "Candidat(e)",
    submitted: "Soumis le",
    finalScore: "Score final",
    outcome: "Décision",
    decisionApproved: "Approuvé",
    decisionRejected: "Non retenu",
    decisionRevision: "Révision demandée",
    comment: "Commentaire",
    evaluationTitle: "Évaluation et retour",
    strengths: "Points forts",
    improvements: "Axes d'amélioration",
    responsesTitle: "Vos réponses",
    thankYou: "Merci pour votre participation.",
  },
};

// Vertical rhythm (pt) — generous line stepping so paragraphs breathe.
const PAGE_MARGIN = 46; // page margin
const BODY_STEP = 16; // line step for ~9.5-10pt body text

/** Keep only characters the built-in PDF fonts can render (Latin-1). */
function sanitize(value) {
  let text = String(value ?? "");
  text = text.replace(/\r/g, "").split("\u0000").join("").replace(/\t/g, " ");
  // Allow printable ASCII + Latin-1 (accents used by FR/EN). Anything else
  // (emojis, CJK…) would render as garbage with the standard fonts — drop it.
  return text.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "");
}

function scoreColor10(score) {
  return score >= 7 ? GREEN : score >= 5 ? AMBER : ROSE;
}

function scoreColor100(score) {
  return score >= 80 ? GREEN : score >= 60 ? AMBER : ROSE;
}

function decisionColor(decision) {
  if (decision === "approved") return GREEN;
  if (decision === "rejected") return ROSE;
  if (decision === "revision_requested") return AMBER;
  return INK;
}

/**
 * Build the result PDF bytes.
 *
 * @param {object} data
 * @param {string} data.lang                     "en" | "fr"
 * @param {string} [data.applicantName]
 * @param {string} [data.submittedAt]            ISO date
 * @param {number} data.finalScore               overall score, 0-100
 * @param {string} [data.ranking]
 * @param {{decision?: string, comment?: string}|null} [data.outcome]  last review
 * @param {Array} [data.dimensions]              { name, score, feedback, strengths[], improvements[] }
 * @param {Array} [data.sections]                { title, items: [{label, value}] }
 * @returns {Uint8Array} PDF bytes
 */
export function buildSubmissionResultPdf(data) {
  const labels = { ...LABELS.en, ...(LABELS[data.lang] || {}) };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentWidth = pageW - PAGE_MARGIN * 2;
  let cursorY = PAGE_MARGIN;

  const ensure = (needed) => {
    if (cursorY + needed > pageH - PAGE_MARGIN) {
      doc.addPage();
      cursorY = PAGE_MARGIN + 8;
    }
  };

  const text = (value) => sanitize(value);

  /**
   * Draw text wrapped to `width`, line by line, so nothing ever runs past the
   * right margin — and paginate line by line so nothing is lost off the bottom
   * either. The font family, size and colour must be set by the caller first:
   * the wrap is measured against those metrics. `cursorY` ends up past the block.
   *
   * With a single line and no `prefix`, the result is identical to drawing the
   * string directly at `cursorY`, so call sites keep their existing rhythm.
   */
  const drawWrapped = ({
    value,
    x = PAGE_MARGIN,
    width = contentWidth,
    lineStep = BODY_STEP,
    gap = 0,
    prefix = null,
    prefixX = PAGE_MARGIN,
    align = "left",
  } = {}) => {
    const lines = doc.splitTextToSize(text(value), width);
    for (let i = 0; i < lines.length; i += 1) {
      if (cursorY + lineStep > pageH - PAGE_MARGIN) {
        doc.addPage();
        cursorY = PAGE_MARGIN + 8;
      }
      if (i === 0 && prefix) doc.text(prefix, prefixX, cursorY);
      doc.text(lines[i], x, cursorY, { align });
      cursorY += lineStep;
    }
    cursorY += gap;
    return lines.length;
  };

  // ─── Header (person + date only — no form/run names) ───────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  cursorY += 6; // keeps the single-line title exactly where it was
  drawWrapped({ value: labels.title, lineStep: 24 });

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
    // A long applicant name (or both parts) wraps instead of running off.
    drawWrapped({ value: idParts.join("   ·   "), lineStep: 16 });
    cursorY += 6;
  } else {
    cursorY += 14;
  }

  // ─── Final score card ──────────────────────────────────────────────────────
  const scoreColor = scoreColor100(Number(data.finalScore) || 0);
  const cardH = 78;
  ensure(cardH + 14);
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(PAGE_MARGIN, cursorY, contentWidth, cardH, 12, 12, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(text(labels.finalScore).toUpperCase(), PAGE_MARGIN + 22, cursorY + 30);
  doc.setFontSize(30);
  doc.setTextColor(...scoreColor);
  doc.text(`${Math.round(Number(data.finalScore) || 0)}%`, PAGE_MARGIN + 22, cursorY + 62);
  if (data.ranking) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    // Wrapped so a long label stays inside the card; the score keeps the left
    // half of it, so the ranking is confined to the right side and to 3 lines.
    let rankLines = doc.splitTextToSize(text(data.ranking), contentWidth - 190);
    if (rankLines.length > 3) {
      rankLines = rankLines.slice(0, 3);
      rankLines[2] = `${rankLines[2].replace(/\s*\S*$/, "")}...`;
    }
    const rankStep = 18;
    const rankTop = cursorY + 50 - ((rankLines.length - 1) * rankStep) / 2;
    rankLines.forEach((line, i) => {
      doc.text(line, pageW - PAGE_MARGIN - 22, rankTop + i * rankStep, { align: "right" });
    });
  }
  cursorY += cardH + 26;

  // ─── Outcome (last review decision) ────────────────────────────────────────
  if (data.outcome && data.outcome.decision) {
    const decision = data.outcome.decision;
    const label =
      decision === "approved" ? labels.decisionApproved
      : decision === "rejected" ? labels.decisionRejected
      : decision === "revision_requested" ? labels.decisionRevision
      : text(decision);
    ensure(64);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(text(labels.outcome).toUpperCase(), PAGE_MARGIN, cursorY);
    cursorY += 16;
    doc.setFontSize(16);
    doc.setTextColor(...decisionColor(decision));
    doc.text(text(label), PAGE_MARGIN, cursorY);
    cursorY += 14;
    if (data.outcome.comment) {
      // Font first: the wrap is measured with the italic metrics it renders in.
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10.5);
      doc.setTextColor(...MUTED);
      drawWrapped({ value: data.outcome.comment, x: PAGE_MARGIN + 16, width: contentWidth - 18, gap: 8 });
    }
    cursorY += 22;
  }

  // ─── Section header (orange rule + title) ──────────────────────────────────
  const sectionTitle = (title) => {
    ensure(40);
    cursorY += 10;
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(2);
    doc.line(PAGE_MARGIN, cursorY, PAGE_MARGIN + 38, cursorY);
    cursorY += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(text(title), PAGE_MARGIN, cursorY);
    cursorY += 24;
  };

  // ─── Evaluation & feedback ─────────────────────────────────────────────────
  if (Array.isArray(data.dimensions) && data.dimensions.length > 0) {
    sectionTitle(labels.evaluationTitle);

    for (const dimension of data.dimensions) {
      const score = dimension.score == null ? null : Number(dimension.score);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      doc.setTextColor(...INK);
      // The dimension name wraps; the score stays on the first line, right.
      const nameLines = doc.splitTextToSize(text(dimension.name || "Untitled"), contentWidth - 80);
      for (let i = 0; i < nameLines.length; i += 1) {
        if (i > 0) cursorY += 16;
        ensure(22);
        doc.text(nameLines[i], PAGE_MARGIN, cursorY + 4);
        if (i === 0 && score != null) {
          doc.setFontSize(11);
          doc.setTextColor(...scoreColor10(score));
          doc.text(`${score}/10`, pageW - PAGE_MARGIN, cursorY + 4, { align: "right" });
          doc.setFontSize(11.5);
          doc.setTextColor(...INK);
        }
      }
      cursorY += 24;

      if (dimension.feedback) {
        // Font first: the wrap is measured with the metrics it renders in.
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        drawWrapped({ value: dimension.feedback, gap: 10 });
      }

      const renderBullets = (title, items, color) => {
        if (!items || items.length === 0) return;
        ensure(30);
        cursorY += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...color);
        doc.text(text(title).toUpperCase(), PAGE_MARGIN, cursorY);
        cursorY += 18;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        for (const item of items) {
          // The bullet follows its text, so a bullet that lands on a new page
          // still gets its marker.
          drawWrapped({ value: item, x: PAGE_MARGIN + 14, width: contentWidth - 20, gap: 7, prefix: "•" });
        }
        cursorY += 4;
      };

      renderBullets(labels.strengths, dimension.strengths, GREEN);
      renderBullets(labels.improvements, dimension.improvements, ROSE);
      cursorY += 14;
    }
    cursorY += 12;
  }

  // ─── Responses (answers) ───────────────────────────────────────────────────
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    sectionTitle(labels.responsesTitle);

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

  // ─── Footer ────────────────────────────────────────────────────────────────
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
 * @param {object} data
 * @param {string} data.lang                      "en" | "fr"
 * @param {string} [data.applicantName]
 * @param {string} [data.submittedAt]             ISO date
 * @param {{title?: string|null, sections: Array<{heading?: string|null, blocks: Array<{type: string, text: string}>}>}} data.document
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
  const sections = Array.isArray(data.document?.sections) ? data.document.sections : [];
  for (const section of sections) {
    const heading = typeof section?.heading === "string" ? section.heading.trim() : "";
    if (heading) {
      ensure(56);
      cursorY += 10;
      doc.setDrawColor(...BRAND_ORANGE);
      doc.setLineWidth(2);
      doc.line(PAGE_MARGIN, cursorY, PAGE_MARGIN + 38, cursorY);
      cursorY += 14;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...INK);
      drawWrapped({ value: heading, lineStep: 20, gap: 8 });
    }

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
