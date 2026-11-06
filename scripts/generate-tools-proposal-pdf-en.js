/**
 * Generates an English PDF proposal: 3 tools to help Future Studio
 * achieve its objectives via ImpactOS.
 *
 * Usage: node scripts/generate-tools-proposal-pdf-en.js
 */
import { jsPDF } from "jspdf";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "Proposal_3_Tools_Future_Studio.pdf");

const MARGIN = 20;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 285;

const COLORS = {
  primary: [15, 76, 92],
  accent: [232, 120, 48],
  text: [30, 35, 40],
  muted: [90, 100, 110],
  lightBg: [245, 248, 250],
  white: [255, 255, 255],
  line: [210, 218, 224],
};

function setColor(doc, rgb) {
  doc.setTextColor(...rgb);
}

function drawFooter(doc, pageNum, totalPages) {
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4);
  doc.setFontSize(8);
  setColor(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text("Future Studio · ImpactOS · Strategic proposal", MARGIN, FOOTER_Y);
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, FOOTER_Y, { align: "right" });
}

function ensureSpace(doc, y, needed, state) {
  if (y + needed > FOOTER_Y - 10) {
    doc.addPage();
    state.page += 1;
    return MARGIN + 8;
  }
  return y;
}

function wrapText(doc, text, maxWidth) {
  return doc.splitTextToSize(text, maxWidth);
}

function sectionTitle(doc, title, y, state) {
  y = ensureSpace(doc, y, 18, state);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  setColor(doc, COLORS.primary);
  doc.text(title, MARGIN, y);
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, y + 2.5, MARGIN + 28, y + 2.5);
  return y + 12;
}

function bodyParagraph(doc, text, y, state, opts = {}) {
  const size = opts.size || 10;
  const leading = opts.leading || 5.2;
  const indent = opts.indent || 0;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(size);
  setColor(doc, opts.color || COLORS.text);
  const lines = wrapText(doc, text, CONTENT_W - indent);
  for (const line of lines) {
    y = ensureSpace(doc, y, leading + 2, state);
    doc.text(line, MARGIN + indent, y);
    y += leading;
  }
  return y + (opts.after || 3);
}

function bullet(doc, text, y, state) {
  y = ensureSpace(doc, y, 10, state);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  setColor(doc, COLORS.accent);
  doc.text("•", MARGIN + 2, y);
  setColor(doc, COLORS.text);
  const lines = wrapText(doc, text, CONTENT_W - 10);
  lines.forEach((line, i) => {
    if (i > 0) y = ensureSpace(doc, y, 7, state);
    doc.text(line, MARGIN + 8, y);
    y += 5;
  });
  return y + 2;
}

function toolCardHeader(doc, number, name, tagline, y, state) {
  y = ensureSpace(doc, y, 28, state);
  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(MARGIN, y - 6, CONTENT_W, 22, 2, 2, "F");

  doc.setFillColor(...COLORS.primary);
  doc.circle(MARGIN + 10, y + 5, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setColor(doc, COLORS.white);
  doc.text(String(number), MARGIN + 10, y + 6.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setColor(doc, COLORS.primary);
  doc.text(name, MARGIN + 20, y + 2);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  setColor(doc, COLORS.muted);
  doc.text(tagline, MARGIN + 20, y + 9);

  return y + 24;
}

function labelRow(doc, label, value, y, state) {
  y = ensureSpace(doc, y, 8, state);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setColor(doc, COLORS.primary);
  doc.text(label, MARGIN, y);
  doc.setFont("helvetica", "normal");
  setColor(doc, COLORS.text);
  const labelW = doc.getTextWidth(label) + 3;
  const lines = wrapText(doc, value, CONTENT_W - labelW);
  doc.text(lines[0], MARGIN + labelW, y);
  y += 5;
  for (let i = 1; i < lines.length; i++) {
    y = ensureSpace(doc, y, 6, state);
    doc.text(lines[i], MARGIN, y);
    y += 5;
  }
  return y + 2;
}

const doc = new jsPDF({ unit: "mm", format: "a4" });
const state = { page: 1 };

doc.setFillColor(...COLORS.primary);
doc.rect(0, 0, PAGE_W, 58, "F");
doc.setFillColor(...COLORS.accent);
doc.rect(0, 58, PAGE_W, 3, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(11);
setColor(doc, [200, 220, 228]);
doc.text("FUTURE STUDIO  ·  IMPACTOS", MARGIN, 18);

doc.setFontSize(22);
setColor(doc, COLORS.white);
doc.text("Strategic proposal", MARGIN, 34);

doc.setFont("helvetica", "normal");
doc.setFontSize(12);
doc.text("Three tools to accelerate the mission", MARGIN, 44);
doc.text("and achieve organisational objectives", MARGIN, 51);

let y = 72;
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
setColor(doc, COLORS.muted);
doc.text(
  `Internal document  ·  ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
  MARGIN,
  y
);
y += 12;

y = sectionTitle(doc, "1. Context and Future Studio objectives", y, state);

y = bodyParagraph(
  doc,
  "Future Studio builds ImpactOS, an operating system for innovation ecosystems. Born as an internal tool, ImpactOS aims to discover, support, track and finance startups in a structured way — with a clear vision: become the reference platform for Africa and emerging markets.",
  y,
  state
);

y = bodyParagraph(doc, "Product mission", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Increase the number of investment-ready startups by providing a single infrastructure to discover, develop, track, support and finance innovative companies.",
  y,
  state
);

y = bodyParagraph(doc, "Success criteria (product reference)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
for (const item of [
  "Founders become investment-ready faster",
  "Program Managers have real-time visibility",
  "Investors identify relevant opportunities more easily",
  "Future Studio manages more startups without increasing operational complexity",
  "All stakeholders collaborate through a single platform",
]) {
  y = bullet(doc, item, y, state);
}

y += 2;
y = bodyParagraph(doc, "The five ImpactOS pillars", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Operations OS · Program OS · Venture OS · Investor OS · Ecosystem OS. Every recommendation below serves at least one of these pillars and one success criterion.",
  y,
  state
);

y = bodyParagraph(doc, "Problem addressed", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "The entrepreneurial ecosystem remains fragmented (Excel, scattered documents, disconnected channels). ImpactOS already centralises much of the journey. The three tools proposed fill strategic blind spots: field engagement (Africa), measurement of the path to investment, and cross-cutting decision intelligence — without rebuilding what already exists (DeepSeek, Notion, Microsoft Calendar, Google Sheets finance, internal messaging).",
  y,
  state
);

y = sectionTitle(doc, "2. The three recommended tools", y, state);

y = toolCardHeader(
  doc,
  1,
  "WhatsApp Business Cloud API (Meta)",
  "Founder engagement channel — Program OS & Venture OS",
  y,
  state
);

y = labelRow(
  doc,
  "Role:",
  "Connect ImpactOS to the dominant communication channel in Africa and emerging markets.",
  y,
  state
);
y = bodyParagraph(doc, "Why this tool?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "ImpactOS's vision explicitly targets Africa and emerging markets. In these contexts, WhatsApp is often founders' primary (sometimes only) daily channel. A web portal alone is not enough: session reminders, deliverables, milestones and mentor feedback are easily missed if the team must open ImpactOS for every interaction.",
  y,
  state
);
y = bodyParagraph(doc, "What it brings to Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Automated reminders: Program OS sessions, Venture OS deliverable deadlines, staff standup / retrospective",
  "Transactional notifications (task acceptance, blockers, milestone validation) without relying solely on email",
  "Higher journey completion rates → more investment-ready startups, faster",
  "Lower operational load for Program Managers (fewer manual follow-ups)",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Objective alignment", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Directly serves the criteria \"founders reach investment readiness faster\" and \"more startups without ops complexity\". Complements ImpactOS internal messaging (optimised for team work) with an external founder/participant channel. Meta Cloud API: templates, webhooks, integrable with existing API routes.",
  y,
  state
);

y = toolCardHeader(
  doc,
  2,
  "PostHog",
  "Product analytics & investment-ready funnel — all pillars",
  y,
  state
);

y = labelRow(
  doc,
  "Role:",
  "Measure real ImpactOS usage and the founder → investment-ready journey.",
  y,
  state
);
y = bodyParagraph(doc, "Why this tool?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "ImpactOS already has operational indicators (tasks, reports, program KPIs) and an AI layer (DeepSeek) for insights. What is missing is a product analytics loop: where founders drop off, which modules truly accelerate the investment-readiness score, which UI frictions slow PMs down. Without this data, Future Studio cannot optimise the product empirically.",
  y,
  state
);
y = bodyParagraph(doc, "What it brings to Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Funnels: signup → program → milestones → deliverables → investment-ready score → investor pipeline",
  "Feature flags & experiments: roll out Venture OS / Investor OS gradually without risk",
  "Optional session replay & heatmaps to fix UX friction without speculative redesign",
  "Self-hostable (data control) or cloud; JS SDK compatible with Next.js",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Objective alignment", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Turns the product success definition into actionable metrics. Helps Future Studio scale ImpactOS as a platform (third-party incubators) by proving what works. Open-source friendly, controlled cost — suited to an organisation that builds rather than buys heavy marketing suites.",
  y,
  state
);

y = toolCardHeader(
  doc,
  3,
  "Metabase",
  "Cross-cutting decision intelligence — Ops, Program, Venture, Investor",
  y,
  state
);

y = labelRow(
  doc,
  "Role:",
  "Executive dashboards connected directly to PostgreSQL (Supabase).",
  y,
  state
);
y = bodyParagraph(doc, "Why this tool?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Recharts covers in-app charts well. Operational reports and finance (Google Sheets) already exist. But leadership and investors need a BI layer: cross cohorts, venture progress, staff blockers, investor pipeline and budgets — without shipping a new Next.js page for every question. Metabase meets that need with read-only access to the same database.",
  y,
  state
);
y = bodyParagraph(doc, "What it brings to Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Executive dashboards: program completion rates, average time to investment-ready, pipeline health",
  "Self-service for PMs / finance / leadership (guided SQL or drag-and-drop)",
  "Alerts (e.g. drop in deliverable submissions, blocker pile-up) → faster intervention",
  "Open-source, self-hostable, native Postgres connection — no double entry or manual Excel exports",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Objective alignment", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Serves Program Managers' real-time visibility, investor decision-making, and Future Studio's ability to run more startups with the same team. Complements Investor OS (product views) with organisation-wide intelligence, without competing with scoring or due diligence already in ImpactOS.",
  y,
  state
);

y = sectionTitle(doc, "3. Comparative summary", y, state);

const tableData = [
  ["Tool", "Primary pillar(s)", "Future Studio objective"],
  ["WhatsApp Business", "Program · Venture", "Field engagement & completion"],
  ["PostHog", "All (product)", "Optimise the investment-ready path"],
  ["Metabase", "Ops · Investor · cross-cut", "Data decisions, scale without complexity"],
];

y = ensureSpace(doc, y, 42, state);
const colW = [42, 58, 70];
const rowH = 9;
tableData.forEach((row, ri) => {
  let x = MARGIN;
  if (ri === 0) {
    doc.setFillColor(...COLORS.primary);
    doc.rect(MARGIN, y - 5, CONTENT_W, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setColor(doc, COLORS.white);
  } else {
    if (ri % 2 === 0) {
      doc.setFillColor(...COLORS.lightBg);
      doc.rect(MARGIN, y - 5, CONTENT_W, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(doc, COLORS.text);
  }
  row.forEach((cell, ci) => {
    doc.text(cell, x + 2, y);
    x += colW[ci];
  });
  y += rowH;
});
y += 6;

y = bodyParagraph(doc, "Selection principles (why these three, and not others)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
for (const item of [
  "Complementarity: none replaces ImpactOS; each extends a blind spot (channel, measurement, BI)",
  "Non-redundancy: we avoid proposing Notion, calendar or Sheets already integrated / in place",
  "Control & cost: self-host or controllable API options — consistent with a Next.js + Postgres stack",
  "Mission impact: each tool explicitly accelerates investment-ready startups or the capacity to support them at scale",
]) {
  y = bullet(doc, item, y, state);
}

y = sectionTitle(doc, "4. Suggested adoption roadmap", y, state);

y = bodyParagraph(doc, "Phase A — Quick wins (4–6 weeks)", y, state, { bold: true, size: 10.5, after: 1 });
y = bullet(
  doc,
  "PostHog: instrument key events (login by role, deliverable submission, milestone progress, investor pipeline view)",
  y,
  state
);
y = bullet(
  doc,
  "Metabase: read-only Postgres connection + 3 dashboards (weekly Ops, Program health, Venture readiness)",
  y,
  state
);

y = bodyParagraph(doc, "Phase B — Founder engagement (6–10 weeks)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
y = bullet(
  doc,
  "WhatsApp Business: reminder templates (session, deliverable, milestone) wired to existing ImpactOS webhooks / jobs; GDPR / consent opt-in",
  y,
  state
);

y = bodyParagraph(doc, "Phase C — Continuous improvement loop", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
y = bullet(
  doc,
  "Use PostHog + Metabase to prioritise Venture OS / Investor OS features by measured impact on investment-readiness",
  y,
  state
);

y = sectionTitle(doc, "5. Conclusion", y, state);
y = bodyParagraph(
  doc,
  "Future Studio has already laid the product foundations (five ImpactOS pillars). To achieve the mission — more investment-ready startups, in Africa and emerging markets — it now needs to: reach founders where they are (WhatsApp), measure what truly accelerates their journey (PostHog), and give the organisation actionable cross-cutting visibility (Metabase).",
  y,
  state
);
y = bodyParagraph(
  doc,
  "These three tools form a coherent set, with low risk of product cannibalisation, and are directly justified by the success criteria documented in the ImpactOS product reference.",
  y,
  state
);

y += 4;
y = ensureSpace(doc, y, 20, state);
doc.setFillColor(...COLORS.lightBg);
doc.roundedRect(MARGIN, y - 4, CONTENT_W, 18, 2, 2, "F");
doc.setFont("helvetica", "italic");
doc.setFontSize(9);
setColor(doc, COLORS.muted);
const sources = wrapText(
  doc,
  "Analysis sources: PRODUCT.md, OVERVIEW.md, README.md, .ai/PROJECT.md — ImpactOS repository (Internal Incubation Management Tracking System).",
  CONTENT_W - 8
);
sources.forEach((line, i) => {
  doc.text(line, MARGIN + 4, y + 2 + i * 4.5);
});

const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  drawFooter(doc, i, totalPages);
}

const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(OUT, buf);
console.log(`PDF written: ${OUT}`);
console.log(`Pages: ${totalPages}`);
