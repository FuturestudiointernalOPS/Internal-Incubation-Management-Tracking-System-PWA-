import { jsPDF } from "jspdf";

/**
 * Submission result PDF (platform form runs).
 *
 * Renders a participant-facing result document server-side from the
 * authoritative records only: the form answers stored on the submission,
 * the latest evaluation (dimensions + overall score) and the last review
 * decision/comment. The document intentionally NEVER mentions how the
 * evaluation was produced — the participant sees only their responses,
 * the evaluation feedback and their final score.
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
    form: "Form",
    run: "Run",
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
    form: "Formulaire",
    run: "Exécution",
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

/** Keep only characters the built-in PDF fonts can render (Latin-1). */
function sanitize(value) {
  let s = String(value ?? "");
  s = s.replace(/\r/g, "").replace(/\u0000/g, "").replace(/\t/g, " ");
  // Allow printable ASCII + Latin-1 (accents used by FR/EN). Anything else
  // (emojis, CJK…) would render as garbage with the standard fonts — drop it.
  return s.replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "");
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
 * @param {string} data.formName                 form title
 * @param {string} [data.runName]
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
  const L = { ...LABELS.en, ...(LABELS[data.lang] || {}) };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 44;
  const W = pageW - M * 2;
  let y = M;

  const ensure = (needed) => {
    if (y + needed > pageH - M) {
      doc.addPage();
      y = M;
    }
  };

  const text = (value) => sanitize(value);

  // ─── Header ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(text(L.title), M, y);
  y += 14;

  const metaParts = [];
  if (data.formName) metaParts.push(`${L.form}: ${text(data.formName)}`);
  if (data.runName) metaParts.push(`${L.run}: ${text(data.runName)}`);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  if (metaParts.length > 0) {
    doc.text(metaParts.join("   ·   "), M, y);
    y += 14;
  }
  const idParts = [];
  if (data.applicantName) idParts.push(`${L.applicant}: ${text(data.applicantName)}`);
  if (data.submittedAt) {
    let d = null;
    try {
      d = new Date(data.submittedAt);
    } catch (_) {}
    if (d && !Number.isNaN(d.getTime())) {
      idParts.push(`${L.submitted}: ${text(d.toLocaleDateString(data.lang === "fr" ? "fr-FR" : "en-GB", { year: "numeric", month: "long", day: "numeric" }))}`);
    }
  }
  if (idParts.length > 0) {
    doc.text(idParts.join("   ·   "), M, y);
    y += 10;
  }
  y += 12;

  // ─── Final score card ──────────────────────────────────────────────────────
  const scoreColor = scoreColor100(Number(data.finalScore) || 0);
  const cardH = 62;
  ensure(cardH + 12);
  doc.setFillColor(...LIGHT_BG);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(M, y, W, cardH, 10, 10, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(text(L.finalScore).toUpperCase(), M + 18, y + 24);
  doc.setFontSize(26);
  doc.setTextColor(...scoreColor);
  doc.text(`${Math.round(Number(data.finalScore) || 0)}%`, M + 18, y + 50);
  if (data.ranking) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(text(data.ranking), pageW - M - 18, y + 38, { align: "right" });
  }
  y += cardH + 16;

  // ─── Outcome (last review decision) ────────────────────────────────────────
  if (data.outcome && data.outcome.decision) {
    const decision = data.outcome.decision;
    const label =
      decision === "approved" ? L.decisionApproved
      : decision === "rejected" ? L.decisionRejected
      : decision === "revision_requested" ? L.decisionRevision
      : text(decision);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(text(L.outcome).toUpperCase(), M, y);
    y += 13;
    doc.setFontSize(14);
    doc.setTextColor(...decisionColor(decision));
    doc.text(text(label), M, y);
    y += 6;
    if (data.outcome.comment) {
      const lines = doc.splitTextToSize(text(data.outcome.comment), W - 16);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      ensure(lines.length * 13 + 10);
      doc.text(lines, M + 12, y + 6);
      y += lines.length * 13 + 16;
    }
    y += 8;
  }

  // ─── Evaluation & feedback ─────────────────────────────────────────────────
  if (Array.isArray(data.dimensions) && data.dimensions.length > 0) {
    ensure(30);
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(2);
    doc.line(M, y, M + 34, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text(L.evaluationTitle), M, y);
    y += 8;

    for (const dim of data.dimensions) {
      const score = dim.score == null ? null : Number(dim.score);
      const blockHead = 18;
      ensure(blockHead);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(text(dim.name || "Untitled"), M, y + 12);
      if (score != null) {
        const c = scoreColor10(score);
        doc.setFontSize(10);
        doc.setTextColor(...c);
        doc.text(`${score}/10`, pageW - M, y + 12, { align: "right" });
      }
      y += blockHead;

      if (dim.feedback) {
        const lines = doc.splitTextToSize(text(dim.feedback), W);
        ensure(lines.length * 12.5 + 4);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        doc.text(lines, M, y);
        y += lines.length * 12.5 + 4;
      }

      const renderBullets = (title, items, color) => {
        if (!items || items.length === 0) return;
        ensure(18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...color);
        doc.text(text(title).toUpperCase(), M, y + 8);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        for (const item of items) {
          const wrapped = doc.splitTextToSize(text(item), W - 16);
          ensure(wrapped.length * 12.5 + 4);
          doc.text("•", M, y + 8);
          doc.text(wrapped, M + 12, y);
          y += wrapped.length * 12.5 + 4;
        }
      };

      renderBullets(L.strengths, dim.strengths, GREEN);
      renderBullets(L.improvements, dim.improvements, ROSE);
      y += 6;
    }
    y += 6;
  }

  // ─── Responses (answers) ───────────────────────────────────────────────────
  if (Array.isArray(data.sections) && data.sections.length > 0) {
    ensure(30);
    doc.setDrawColor(...BRAND_ORANGE);
    doc.setLineWidth(2);
    doc.line(M, y, M + 34, y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(text(L.responsesTitle), M, y);
    y += 10;

    for (const sec of data.sections) {
      if (!sec.items || sec.items.length === 0) continue;
      if (sec.title) {
        ensure(22);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...BRAND_ORANGE);
        doc.text(text(sec.title).toUpperCase(), M, y + 6);
        y += 14;
      }

      for (const item of sec.items) {
        ensure(16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(...INK);
        doc.text(text(item.label), M, y + 7);
        y += 14;
        const lines = doc.splitTextToSize(text(item.value), W);
        ensure(lines.length * 12 + 6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        doc.text(lines, M, y);
        y += lines.length * 12 + 6;
      }
      y += 4;
    }
    y += 10;
  }

  // ─── Footer ────────────────────────────────────────────────────────────────
  if (y + 40 < pageH - M) {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 44, pageW - M, pageH - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FAINT);
    doc.text(text(L.thankYou), M, pageH - 32);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_ORANGE);
    doc.text("Impact OS", pageW - M, pageH - 32, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
