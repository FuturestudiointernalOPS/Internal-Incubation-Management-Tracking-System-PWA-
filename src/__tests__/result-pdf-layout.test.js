/**
 * Result PDF layout — nothing may run off the sheet.
 *
 * The participant-facing document is built from form data: question labels,
 * answers, dimension names, feedback, review comments and the applicant name
 * are all free text of unknown length. This test builds the real PDF and reads
 * its content stream, so it fails if any drawn line escapes the page margins
 * (the reported symptom: a long sentence went off the right edge instead of
 * wrapping) or if content is written below the bottom of the page.
 */
const { jsPDF } = require("jspdf");
const { buildSubmissionResultPdf, buildComposedReportPdf } = require("@/models/platform/resultPdf");

const MARGIN = 46; // page margin used by the builder
const TOLERANCE = 0.75;
const PAGE_W = 595.28; // A4 width in pt

const FAMILY = {
  Helvetica: ["helvetica", "normal"],
  "Helvetica-Bold": ["helvetica", "bold"],
  "Helvetica-Oblique": ["helvetica", "italic"],
  "Helvetica-BoldOblique": ["helvetica", "bolditalic"],
};

const probe = new jsPDF({ unit: "pt", format: "a4" });
const textWidth = (baseFont, size, text) => {
  const [family, style] = FAMILY[baseFont] || FAMILY.Helvetica;
  probe.setFont(family, style);
  probe.setFontSize(size);
  return probe.getTextWidth(text);
};

const unescapePdf = (escaped) =>
  escaped
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, octalDigits) => String.fromCharCode(parseInt(octalDigits, 8)));

/** Every text run actually written to the document, with its position. */
function drawnRuns(bytes) {
  const pdf = Buffer.from(bytes).toString("latin1");
  expect(pdf).not.toMatch(/FlateDecode/); // the stream must stay readable here

  const fonts = {};
  for (const match of pdf.matchAll(/\/F(\d+) 0 obj[\s\S]{0,200}?\/BaseFont \/([A-Za-z-]+)/g)) {
    fonts[`/F${match[1]}`] = match[2];
  }

  const runs = [];
  for (const chunk of pdf.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g) || []) {
    const body = chunk.replace(/^stream\r?\n/, "").replace(/\r?\nendstream$/, "");
    let font = "/F1";
    let size = 10;
    let leading = 11.5;
    let x = 0;
    let y = 0;
    const operations = body.matchAll(
      /\/(F\d+) ([\d.]+) Tf|([\d.-]+) TL|([\d.-]+) ([\d.-]+) (?:Td|Tm)|T\*|\(((?:[^()\\]|\\.)*)\) Tj|\[((?:[^\]])*)\] TJ|BT|ET/g,
    );
    for (const token of operations) {
      if (token[0] === "BT") {
        x = 0;
        y = 0;
      } else if (token[0] === "T*") {
        y -= leading;
        runs.push({ x, y, text: "<next line>", font, size });
      } else if (token[1]) {
        font = `/${token[1]}`;
        size = parseFloat(token[2]);
      } else if (token[3] !== undefined) {
        leading = parseFloat(token[3]);
      } else if (token[4] !== undefined) {
        x += parseFloat(token[4]);
        y += parseFloat(token[5]);
      } else if (token[6] !== undefined || token[7] !== undefined) {
        const raw = (token[6] !== undefined ? token[6] : token[7]).replace(/\)\s*[\d.-]+\s*\(/g, "");
        const text = unescapePdf(raw);
        if (text) runs.push({ x, y, text, font, size });
      }
    }
  }
  return { pdf, runs, fonts };
}

/** Runs that don't fit the print area. The footer sits outside on purpose. */
function outOfMargin(runs, fonts) {
  return runs.filter((run) => {
    const text = run.text === "<next line>" ? "M" : run.text;
    const width = textWidth(fonts[run.font] || "Helvetica", run.size, text);
    const isFooter = /Impact OS|Thank you|Merci pour/.test(run.text);
    if (run.x + width > PAGE_W - MARGIN + TOLERANCE) return true; // past the right edge
    if (run.x < MARGIN - TOLERANCE) return true; // past the left edge
    if (run.y < MARGIN - TOLERANCE && !isFooter) return true; // below the bottom margin
    return false;
  });
}

const long = (sentence, times) => Array.from({ length: times }, () => sentence).join(" ");

const bigForm = {
  lang: "fr",
  applicantName: long("Prénom-Nom-Très-Long-De-Candidat", 8),
  submittedAt: "2026-09-17T10:00:00Z",
  finalScore: 87,
  ranking: long("1er sur 240 candidats évalués dans cette cohorte régionale", 6),
  outcome: {
    decision: "revision_requested",
    comment: long("Votre candidature présente des points solides mais nous souhaitons des précisions.", 40),
  },
  dimensions: Array.from({ length: 4 }, (_, dimensionIndex) => ({
    name: long(`Dimension ${dimensionIndex + 1} — capacité à structurer et documenter votre modèle économique`, 4),
    score: (dimensionIndex % 10) + 1,
    feedback: long("Le raisonnement est clair et documenté, la démonstration reste à compléter.", 25),
    strengths: [long("Bonne connaissance du terrain et des acteurs locaux", 12)],
    improvements: ["Budget: " + "https://exemple.test/".repeat(40)],
  })),
  sections: [
    {
      title: long("Section 1 — décrivez précisément votre parcours et vos motivations", 5),
      items: [
        {
          label: long("Question 1 : pouvez-vous détailler précisément les étapes de votre projet ?", 3),
          value: long("Votre réponse détaillée ici.", 60),
        },
        {
          label: "Question 2 : lien vers votre site ?",
          value: "https://tres-long-domaine.test/" + "chemin-tres-long-sans-espace/".repeat(60),
        },
      ],
    },
  ],
};

describe("result PDF layout", () => {
  test("a long question, answer and dimension name still fit the page width", () => {
    const { pdf, runs, fonts } = drawnRuns(buildSubmissionResultPdf(bigForm));

    // The document really is multi-page and really does contain many lines.
    expect((pdf.match(/\/Type \/Page[^s]/g) || []).length).toBeGreaterThan(1);
    expect(runs.length).toBeGreaterThan(200);
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });

  test("an unbreakable long link is broken instead of overflowing", () => {
    const { runs, fonts } = drawnRuns(
      buildSubmissionResultPdf({
        lang: "en",
        finalScore: 10,
        sections: [
          {
            items: [
              { label: "Link", value: "https://example.test/" + "x".repeat(600) },
            ],
          },
        ],
      }),
    );
    const linkLines = runs.filter((run) => run.text.includes("xxxx"));
    expect(linkLines.length).toBeGreaterThan(1); // split, not one huge line
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });

  test("a paragraph longer than a page flows onto the next page instead of being lost", () => {
    const { pdf, runs, fonts } = drawnRuns(
      buildSubmissionResultPdf({
        lang: "en",
        finalScore: 40,
        dimensions: [{ name: "Depth", score: 4, feedback: long("word", 4000) }],
      }),
    );
    expect((pdf.match(/\/Type \/Page[^s]/g) || []).length).toBeGreaterThan(1);
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });
});

/**
 * The AI-composed report (a run with an Output Instruction) is drawn by a
 * different renderer but must carry the same layout guarantees: an
 * administrator's instruction can change the structure, never break the page.
 * Its text is model output, so it is at least as hostile as form free text.
 */
describe("composed report PDF layout", () => {
  test("a long composed report fits the margins and paginates", () => {
    const composed = {
      title: long("Rapport Founder Fit personnalisé", 6),
      sections: Array.from({ length: 6 }, (_, sectionIndex) => ({
        heading: long(`Section ${sectionIndex + 1} — ce que vos réponses révèlent`, 5),
        blocks: [
          { type: "paragraph", text: long("Votre réponse montre une compréhension claire du problème client.", 40) },
          { type: "bullet", text: long("Point à documenter", 12) },
          { type: "bullet", text: "https://exemple.test/" + "x".repeat(600) },
        ],
      })),
    };

    const { pdf, runs, fonts } = drawnRuns(
      buildComposedReportPdf({
        lang: "fr",
        applicantName: long("Prénom-Nom-Très-Long-De-Candidat", 8),
        submittedAt: "2026-09-17T10:00:00Z",
        document: composed,
      }),
    );

    expect((pdf.match(/\/Type \/Page[^s]/g) || []).length).toBeGreaterThan(1);
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });

  test("a section heading and a paragraph longer than a page still wrap", () => {
    const { pdf, runs, fonts } = drawnRuns(
      buildComposedReportPdf({
        lang: "en",
        document: {
          title: "Executive Summary",
          sections: [{ heading: long("Key findings", 30), blocks: [{ type: "paragraph", text: long("word", 3000) }] }],
        },
      }),
    );
    expect((pdf.match(/\/Type \/Page[^s]/g) || []).length).toBeGreaterThan(1);
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });

  test("an empty composed document is still a valid, margin-safe PDF", () => {
    const { pdf, runs, fonts } = drawnRuns(
      buildComposedReportPdf({ lang: "en", document: { title: null, sections: [] } }),
    );
    expect(pdf.startsWith("%PDF")).toBe(true);
    expect(outOfMargin(runs, fonts)).toEqual([]);
  });
});
