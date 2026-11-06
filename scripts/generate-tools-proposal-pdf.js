/**
 * Génère un PDF de proposition : 3 outils pour aider Future Studio
 * à atteindre ses objectifs via ImpactOS.
 *
 * Usage: node scripts/generate-tools-proposal-pdf.js
 */
import { jsPDF } from "jspdf";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "Proposition_3_Outils_Future_Studio.pdf");

const MARGIN = 20;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = 285;

const COLORS = {
  primary: [15, 76, 92], // deep teal — not purple
  accent: [232, 120, 48], // warm coral
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
  doc.text("Future Studio · ImpactOS · Proposition stratégique", MARGIN, FOOTER_Y);
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
  // background bar
  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(MARGIN, y - 6, CONTENT_W, 22, 2, 2, "F");

  // number circle
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

// ─── Build document ───────────────────────────────────────────
const doc = new jsPDF({ unit: "mm", format: "a4" });
const state = { page: 1 };

// Cover header band
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
doc.text("Proposition stratégique", MARGIN, 34);

doc.setFont("helvetica", "normal");
doc.setFontSize(12);
doc.text("Trois outils pour accélérer la mission", MARGIN, 44);
doc.text("et atteindre les objectifs organisationnels", MARGIN, 51);

let y = 72;
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
setColor(doc, COLORS.muted);
doc.text(`Document interne  ·  ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, MARGIN, y);
y += 12;

// ── Contexte ──
y = sectionTitle(doc, "1. Contexte et objectifs de Future Studio", y, state);

y = bodyParagraph(
  doc,
  "Future Studio développe ImpactOS, un système d'exploitation pour les écosystèmes d'innovation. Né comme outil interne, ImpactOS vise à découvrir, accompagner, suivre et financer des startups de façon structurée — avec une vision claire : devenir la référence en Afrique et sur les marchés émergents.",
  y,
  state
);

y = bodyParagraph(doc, "Mission produit", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Augmenter le nombre de startups prêtes à recevoir des investissements, en fournissant une infrastructure unique pour découvrir, développer, suivre, accompagner et financer des entreprises innovantes.",
  y,
  state
);

y = bodyParagraph(doc, "Critères de succès (référence produit)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
for (const item of [
  "Les fondateurs deviennent investment-ready plus rapidement",
  "Les Program Managers ont une visibilité en temps réel",
  "Les investisseurs identifient plus facilement les opportunités pertinentes",
  "Future Studio gère plus de startups sans augmenter la complexité opérationnelle",
  "Tous les acteurs collaborent via une plateforme unique",
]) {
  y = bullet(doc, item, y, state);
}

y += 2;
y = bodyParagraph(doc, "Les cinq piliers ImpactOS", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Operations OS · Program OS · Venture OS · Investor OS · Ecosystem OS. Toute recommandation ci-dessous sert au moins un de ces piliers et un critère de succès.",
  y,
  state
);

y = bodyParagraph(doc, "Problème adressé", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "L'écosystème reste fragmenté (Excel, documents dispersés, canaux déconnectés). ImpactOS centralise déjà une grande partie du parcours. Les trois outils proposés comblent des angles morts stratégiques : engagement terrain (Afrique), mesure du parcours vers l'investissement, et intelligence décisionnelle transverse — sans reconstruire ce qui existe déjà (DeepSeek, Notion, calendrier Microsoft, finance Google Sheets, messagerie interne).",
  y,
  state
);

// ── Outil 1 ──
y = sectionTitle(doc, "2. Les trois outils recommandés", y, state);

y = toolCardHeader(
  doc,
  1,
  "WhatsApp Business Cloud API (Meta)",
  "Canal d'engagement fondateurs — Program OS & Venture OS",
  y,
  state
);

y = labelRow(doc, "Rôle :", "Relier ImpactOS au canal de communication dominant en Afrique et sur les marchés émergents.", y, state);
y = bodyParagraph(doc, "Pourquoi cet outil ?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "La vision ImpactOS cible explicitement l'Afrique et les marchés émergents. Dans ces contextes, WhatsApp est souvent le premier (parfois le seul) canal quotidien des fondateurs. Un portail web seul ne suffit pas : les rappels de sessions, livrables, jalons et feedback mentor risquent d'être manqués si l'équipe doit ouvrir ImpactOS pour chaque interaction.",
  y,
  state
);
y = bodyParagraph(doc, "Ce que ça apporte à Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Rappels automatiques : sessions Program OS, échéances de livrables Venture OS, standup / rétrospective staff",
  "Notifications transactionnelles (acceptation de tâche, blocage, validation de jalon) sans dépendre uniquement de l'e-mail",
  "Meilleur taux de complétion des parcours → plus de startups investment-ready, plus vite",
  "Charge opérationnelle réduite pour les Program Managers (moins de relances manuelles)",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Alignement objectifs", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Sert directement les critères « fondateurs plus rapides vers l'investissement » et « plus de startups sans complexité ops ». Complète la messagerie interne ImpactOS (optimisée pour le travail d'équipe) par un canal externe fondateur/participant. API Cloud Meta : templates, webhooks, intégrable aux routes API existantes.",
  y,
  state
);

// ── Outil 2 ──
y = toolCardHeader(
  doc,
  2,
  "PostHog",
  "Analytique produit & funnel investment-ready — tous les piliers",
  y,
  state
);

y = labelRow(
  doc,
  "Rôle :",
  "Mesurer l'usage réel d'ImpactOS et le parcours fondateur → investment-ready.",
  y,
  state
);
y = bodyParagraph(doc, "Pourquoi cet outil ?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "ImpactOS dispose déjà d'indicateurs opérationnels (tâches, rapports, KPIs de programme) et d'une couche IA (DeepSeek) pour insights. En revanche, il manque une boucle analytique produit : où les fondateurs décrochent, quels modules accélèrent vraiment le score d'investment-readiness, quelles frictions UI freinent les PMs. Sans ces données, Future Studio ne peut pas optimiser le produit de façon empirique.",
  y,
  state
);
y = bodyParagraph(doc, "Ce que ça apporte à Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Funnels : inscription → programme → jalons → livrables → score investment-ready → pipeline investisseur",
  "Feature flags & experiments : déployer Venture OS / Investor OS progressivement sans risque",
  "Session replay & heatmaps (optionnels) pour corriger les frictions UX sans redesign spéculatif",
  "Self-hostable (aligné contrôle des données) ou cloud ; SDK JS compatible Next.js",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Alignement objectifs", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Transforme la définition de succès produit en métriques actionnables. Aide Future Studio à scaler ImpactOS comme plateforme (incubateurs tiers) en prouvant ce qui marche. Open-source friendly, coût maîtrisé — adapté à une organisation qui construit plutôt qu'elle n'achète des suites marketing lourdes.",
  y,
  state
);

// ── Outil 3 ──
y = toolCardHeader(
  doc,
  3,
  "Metabase",
  "Intelligence décisionnelle transverse — Ops, Program, Venture, Investor",
  y,
  state
);

y = labelRow(
  doc,
  "Rôle :",
  "Tableaux de bord exécutifs branchés directement sur PostgreSQL (Supabase).",
  y,
  state
);
y = bodyParagraph(doc, "Pourquoi cet outil ?", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Recharts couvre bien les graphiques in-app. Les rapports opérationnels et finance (Google Sheets) existent. Mais la direction et les investisseurs ont besoin d'une couche BI : croiser cohortes, progression des ventures, blocages staff, pipeline investisseur et budgets — sans demander une nouvelle page Next.js pour chaque question. Metabase répond à ce besoin en lecture seule sur la même base.",
  y,
  state
);
y = bodyParagraph(doc, "Ce que ça apporte à Future Studio", y, state, { bold: true, size: 10.5, after: 1 });
for (const item of [
  "Dashboards exécutifs : taux de complétion programmes, temps moyen vers investment-ready, santé du pipeline",
  "Self-service pour PMs / finance / leadership (questions SQL guidées ou drag-and-drop)",
  "Alertes (ex. : chute de soumissions livrables, accumulation de blocages) → intervention rapide",
  "Open-source, self-hostable, connexion native Postgres — pas de double saisie ni d'export Excel manuel",
]) {
  y = bullet(doc, item, y, state);
}
y = bodyParagraph(doc, "Alignement objectifs", y, state, { bold: true, size: 10.5, after: 1 });
y = bodyParagraph(
  doc,
  "Sert la visibilité temps réel des Program Managers, la prise de décision investisseurs, et la capacité de Future Studio à piloter plus de startups avec la même équipe. Complète Investor OS (vues produit) par une intelligence organisationnelle transverse, sans concurrencer le scoring ou la due diligence déjà dans ImpactOS.",
  y,
  state
);

// ── Synthèse ──
y = sectionTitle(doc, "3. Synthèse comparative", y, state);

const tableData = [
  ["Outil", "Pilier(s) principal(aux)", "Objectif Future Studio"],
  ["WhatsApp Business", "Program · Venture", "Engagement terrain & complétion"],
  ["PostHog", "Tous (produit)", "Optimiser le chemin investment-ready"],
  ["Metabase", "Ops · Investor · transverse", "Décisions data, scale sans complexité"],
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

y = bodyParagraph(doc, "Principes de choix (pourquoi ces trois, et pas d'autres)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
for (const item of [
  "Complémentarité : aucun ne remplace ImpactOS ; chacun étend un angle mort (canal, mesure, BI)",
  "Non-redondance : on évite de proposer Notion, calendrier ou Sheets déjà intégrés / en place",
  "Contrôle & coût : options self-host ou API maîtrisables — cohérent avec une stack Next.js + Postgres",
  "Impact mission : chaque outil accélère explicitement le nombre de startups investment-ready ou la capacité à les accompagner à l'échelle",
]) {
  y = bullet(doc, item, y, state);
}

// ── Feuille de route ──
y = sectionTitle(doc, "4. Feuille de route d'adoption suggérée", y, state);

y = bodyParagraph(doc, "Phase A — Quick wins (4–6 semaines)", y, state, { bold: true, size: 10.5, after: 1 });
y = bullet(
  doc,
  "PostHog : instrumentation des événements clés (login par rôle, soumission livrable, progression jalon, vue pipeline investisseur)",
  y,
  state
);
y = bullet(
  doc,
  "Metabase : connexion lecture seule Postgres + 3 dashboards (Ops hebdo, Program health, Venture readiness)",
  y,
  state
);

y = bodyParagraph(doc, "Phase B — Engagement fondateurs (6–10 semaines)", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
y = bullet(
  doc,
  "WhatsApp Business : templates de rappels (session, livrable, jalon) branchés sur les webhooks / jobs ImpactOS existants ; opt-in RGPD / consentement",
  y,
  state
);

y = bodyParagraph(doc, "Phase C — Boucle d'amélioration continue", y, state, {
  bold: true,
  size: 10.5,
  after: 1,
});
y = bullet(
  doc,
  "Utiliser PostHog + Metabase pour prioriser les features Venture OS / Investor OS selon l'impact mesuré sur l'investment-readiness",
  y,
  state
);

// ── Conclusion ──
y = sectionTitle(doc, "5. Conclusion", y, state);
y = bodyParagraph(
  doc,
  "Future Studio a déjà posé les fondations produit (cinq piliers ImpactOS). Pour atteindre la mission — plus de startups prêtes à l'investissement, en Afrique et sur les marchés émergents — il faut maintenant : parler aux fondateurs là où ils sont (WhatsApp), mesurer ce qui accélère réellement leur parcours (PostHog), et donner à l'organisation une vision transverse actionnable (Metabase).",
  y,
  state
);
y = bodyParagraph(
  doc,
  "Ces trois outils forment un ensemble cohérent, à faible risque de cannibalisation du produit, et directement justifiés par les critères de succès documentés dans la référence produit ImpactOS.",
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
  "Sources d'analyse : PRODUCT.md, OVERVIEW.md, README.md, .ai/PROJECT.md — dépôt ImpactOS (Internal Incubation Management Tracking System).",
  CONTENT_W - 8
);
sources.forEach((line, i) => {
  doc.text(line, MARGIN + 4, y + 2 + i * 4.5);
});

// Footers on all pages
const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  drawFooter(doc, i, totalPages);
}

const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(OUT, buf);
console.log(`PDF écrit : ${OUT}`);
console.log(`Pages : ${totalPages}`);
