/**
 * Platform result PDF — shared rendering vocabulary (VIEW layer).
 *
 * The colour palette, the bilingual header/footer copy and the small parsing
 * and colour helpers shared by the two result renderers. Split verbatim out of
 * `models/platform/resultPdf.js` — see docs/LAYER_SPLIT.md. Not re-exported by
 * the barrel: only the two builders are the module's public surface.
 */

export const BRAND_ORANGE = [255, 102, 0]; // --brand-orange
export const INK = [15, 23, 42]; // --text-primary
export const MUTED = [100, 116, 139]; // slate-500
export const FAINT = [148, 163, 184]; // slate-400
export const GREEN = [5, 150, 105]; // emerald-600
export const AMBER = [217, 119, 6]; // amber-600
export const ROSE = [225, 29, 72]; // rose-700
export const LIGHT_BG = [241, 245, 249]; // slate-100
export const BORDER = [203, 213, 225]; // slate-300

export const LABELS = {
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
export const PAGE_MARGIN = 46; // page margin
export const BODY_STEP = 16; // line step for ~9.5-10pt body text

/** Keep only characters the built-in PDF fonts can render (Latin-1). */
export function sanitize(value) {
  let text = String(value ?? "");
  text = text.replace(/\r/g, "").split("\u0000").join("").replace(/\t/g, " ");
  // Allow printable ASCII + Latin-1 (accents used by FR/EN). Anything else
  // (emojis, CJK…) would render as garbage with the standard fonts — drop it.
  return text.replace(/[^\n\x20-\x7E\xA0-\xFF]/g, "");
}

export function scoreColor10(score) {
  return score >= 7 ? GREEN : score >= 5 ? AMBER : ROSE;
}

export function scoreColor100(score) {
  return score >= 80 ? GREEN : score >= 60 ? AMBER : ROSE;
}

export function decisionColor(decision) {
  if (decision === "approved") return GREEN;
  if (decision === "rejected") return ROSE;
  if (decision === "revision_requested") return AMBER;
  return INK;
}
