import { jsPDF } from "jspdf";

/**
 * LMS certificate PDF generation (Phase 5).
 *
 * The PDF is built SERVER-SIDE from the authoritative certificate record only —
 * never from client-supplied name/course/date/certificate_id (spec §16-17).
 * The download request identifies the certificate; the server loads the record
 * and this module renders it.
 *
 * Internationalization: labels default to English (the certificate's formal
 * language for V1) but the builder accepts an optional `labels` map and a
 * `lang` for the issue date, so multi-language PDFs extend cleanly later
 * (spec §44) without a separate translation system.
 */

const DEFAULT_LABELS = {
  title: "CERTIFICATE OF COMPLETION",
  certifiesThat: "This certifies that",
  hasCompleted: "has successfully completed",
  issuedBy: "Issued by Future Studio",
  issued: "Issued",
  certificateId: "Certificate ID",
};

const BRAND_ORANGE = [255, 102, 0]; // --brand-orange
const INK = [15, 23, 42]; // --text-primary (light)
const MUTED = [100, 116, 139]; // slate-500

function truncate(text, maxChars) {
  const s = String(text || "");
  return s.length <= maxChars ? s : `${s.slice(0, maxChars - 1)}…`;
}

function formatIssueDate(value, lang) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang || "en", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Build the certificate PDF bytes for an authoritative certificate record.
 *
 * @param {object} cert  certificate record: { certificate_number, learner_name,
 *                       course_title, issued_at, status }
 * @param {{labels?: object, lang?: string}} [opts]
 * @returns {Uint8Array} PDF bytes
 */
export function buildCertificatePdf(cert, { labels = {}, lang = "en" } = {}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(); // 841.89
  const H = doc.internal.pageSize.getHeight(); // 595.28
  const cx = W / 2;

  // Frame
  doc.setDrawColor(...BRAND_ORANGE);
  doc.setLineWidth(2.5);
  doc.rect(28, 28, W - 56, H - 56);
  doc.setLineWidth(0.75);
  doc.rect(36, 36, W - 72, H - 72);

  // Title
  doc.setTextColor(...BRAND_ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text(truncate(L.title, 60), cx, 150, { align: "center" });

  // Statement
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(L.certifiesThat, cx, 205, { align: "center" });

  // Learner name
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(truncate(cert.learner_name, 42), cx, 262, { align: "center" });

  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(L.hasCompleted, cx, 302, { align: "center" });

  // Course title
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(truncate(cert.course_title, 64), cx, 352, { align: "center" });

  // Issuer
  doc.setTextColor(...MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(L.issuedBy, cx, 402, { align: "center" });

  // Meta
  doc.setFontSize(10);
  doc.text(`${L.issued}: ${formatIssueDate(cert.issued_at, lang)}`, cx, 468, {
    align: "center",
  });
  doc.text(`${L.certificateId}: ${cert.certificate_number}`, cx, 488, {
    align: "center",
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
