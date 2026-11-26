"use client";

import { jsPDF } from "jspdf";

/**
 * The executive-summary PDF for one form run.
 *
 * One document, built from the SAME data the analytics tab already shows — the
 * deterministic stats, the AI synthesis, and the question distributions. Nothing
 * here invents a number; a section with no data is simply omitted rather than
 * rendered as a zero.
 *
 * The structure follows the studio's portfolio-intelligence report format:
 * header → executive summary → key metrics → question takeaways → response
 * distributions → footer.
 */

const ORANGE = [224, 88, 0];
const INK = [24, 24, 27];
const MUTED = [105, 105, 115];

function slugify(name) {
  return String(name || "executive-summary")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "executive-summary";
}

/** Split the model's summary into displayable paragraphs. */
function paragraphs(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const blocks = raw.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks;
  return raw.split(/\n/).map((line) => line.trim()).filter(Boolean);
}

/**
 * @param {object} args
 * @param {{name?: string, form_name?: string}} args.selectedRun
 * @param {{stats?: {totalSubmissions?: number, uniqueVentures?: number, completionRate?: number}, questionAnalytics?: Array}} args.data
 * @param {{executiveSummary?: string, topMetrics?: Array, questionHighlights?: Array}} args.ai
 */
export function downloadExecutiveSummaryPdf({ selectedRun = {}, data = {}, ai = {} }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = 48;

  const ensure = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = 48;
    }
  };

  const centered = (text, { size = 12, font = "normal", color = INK } = {}) => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, pageWidth / 2, y, { align: "center" });
    y += size + 6;
  };

  const rule = () => {
    doc.setDrawColor(...ORANGE);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  };

  const section = (label) => {
    ensure(40);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...ORANGE);
    doc.text(label.toUpperCase(), margin, y);
    y += 18;
  };

  const paragraph = (text) => {
    const lines = doc.splitTextToSize(text, contentWidth);
    ensure(lines.length * 13 + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 6;
  };

  const bullet = (text) => {
    const lines = doc.splitTextToSize(text, contentWidth - 16);
    ensure(lines.length * 13 + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text("•", margin, y);
    doc.text(lines, margin + 14, y);
    y += lines.length * 13 + 2;
  };

  const subLine = (text) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(text, margin, y);
    y += 12;
  };

  // ── Header ────────────────────────────────────────────────────────────────
  centered("FUTURE STUDIO", { size: 20, font: "bold", color: ORANGE });
  centered("STARTUP PORTFOLIO INTELLIGENCE REPORT", { size: 14, font: "bold" });

  const runLabel = [selectedRun.name, selectedRun.form_name].filter(Boolean).join("  |  ");
  if (runLabel) centered(runLabel, { size: 10, color: MUTED });

  centered(`Reporting Scope: ${data.stats?.totalSubmissions ?? 0} Startups`, { size: 10, color: MUTED });
  centered("Report Type: Portfolio Overview & Performance Snapshot", { size: 10, color: MUTED });
  y += 4;
  rule();

  // ── Executive summary ─────────────────────────────────────────────────────
  if (ai.executiveSummary) {
    section("Executive Summary");
    paragraphs(ai.executiveSummary).forEach(paragraph);
  }

  // ── Key metrics ───────────────────────────────────────────────────────────
  section("Portfolio Key Metrics");
  const stats = data.stats || {};
  const metrics = [
    stats.totalSubmissions != null && `Total Startups: ${stats.totalSubmissions}`,
    stats.uniqueVentures != null && `Unique Ventures: ${stats.uniqueVentures}`,
    stats.completionRate != null && `Completion Rate: ${stats.completionRate}%`,
    ...(ai.topMetrics || []).map((metric) => `${metric.label}: ${metric.value}${metric.sub ? ` — ${metric.sub}` : ""}`),
  ].filter(Boolean);
  metrics.forEach(bullet);

  // ── Question takeaways ────────────────────────────────────────────────────
  const highlights = ai.questionHighlights || [];
  if (highlights.length > 0) {
    section("Key Question Takeaways");
    highlights.forEach((item) => bullet(`${item.question}: ${item.takeaway}`));
  }

  // ── Response distributions ────────────────────────────────────────────────
  const questions = data.questionAnalytics || [];
  if (questions.length > 0) {
    section("Question Responses & Distributions");
    questions.forEach((question) => {
      ensure(48);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(question.label || "Question", margin, y);
      y += 13;

      const meta = [
        question.type && `Type: ${question.type}`,
        question.answeredCount != null && `Answered by ${question.answeredCount}`,
        question.average != null && `Average: ${question.average}`,
      ].filter(Boolean).join(" · ");
      if (meta) subLine(meta);

      const frequencies = Object.entries(question.frequencies || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
      frequencies.forEach(([option, count]) => {
        const percent = Math.round((count / (question.answeredCount || 1)) * 100);
        bullet(`${option} — ${count} (${percent}%)`);
      });
      if (frequencies.length === 0) subLine("No responses recorded.");
      y += 6;
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  ensure(44);
  y += 8;
  rule();
  centered("FUTURE STUDIO", { size: 10, font: "bold", color: ORANGE });
  centered("Building Ventures. Creating Opportunities. Driving Impact.", { size: 9, color: MUTED });

  doc.save(`${slugify(selectedRun.name)}-executive-summary.pdf`);
}
