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
const { buildSubmissionResultPdf } = require("@/models/platform/resultPdf");

const M = 46; // page margin used by the builder
const TOL = 0.75;
const PAGE_W = 595.28; // A4 width in pt

const FAMILY = {
  Helvetica: ["helvetica", "normal"],
  "Helvetica-Bold": ["helvetica", "bold"],
  "Helvetica-Oblique": ["helvetica", "italic"],
  "Helvetica-BoldOblique": ["helvetica", "bolditalic"],
};

const probe = new jsPDF({ unit: "pt", format: "a4" });
const textWidth = (baseFont, size, str) => {
  const [family, style] = FAMILY[baseFont] || FAMILY.Helvetica;
  probe.setFont(family, style);
  probe.setFontSize(size);
  return probe.getTextWidth(str);
};

const unescapePdf = (s) =>
  s
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

/** Every text run actually written to the document, with its position. */
function drawnRuns(bytes) {
  const pdf = Buffer.from(bytes).toString("latin1");
  expect(pdf).not.toMatch(/FlateDecode/); // the stream must stay readable here

  const fonts = {};
  for (const m of pdf.matchAll(/\/F(\d+) 0 obj[\s\S]{0,200}?\/BaseFont \/([A-Za-z-]+)/g)) {
    fonts[`/F${m[1]}`] = m[2];
  }

  const runs = [];
  for (const chunk of pdf.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g) || []) {
    const body = chunk.replace(/^stream\r?\n/, "").replace(/\r?\nendstream$/, "");
    let font = "/F1";
    let size = 10;
    let leading = 11.5;
    let x = 0;
    let y = 0;
    const ops = body.matchAll(
      /\/(F\d+) ([\d.]+) Tf|([\d.-]+) TL|([\d.-]+) ([\d.-]+) (?:Td|Tm)|T\*|\(((?:[^()\\]|\\.)*)\) Tj|\[((?:[^\]])*)\] TJ|BT|ET/g,
    );
    for (const tok of ops) {
      if (tok[0] === "BT") {
        x = 0;
        y = 0;
      } else if (tok[0] === "T*") {
        y -= leading;
        runs.push({ x, y, text: "<next line>", font, size });
      } else if (tok[1]) {
        font = `/${tok[1]}`;
        size = parseFloat(tok[2]);
      } else if (tok[3] !== undefined) {
        leading = parseFloat(tok[3]);
      } else if (tok[4] !== undefined) {
        x += parseFloat(tok[4]);
        y += parseFloat(tok[5]);
      } else if (tok[6] !== undefined || tok[7] !== undefined) {
        const raw = (tok[6] !== undefined ? tok[6] : tok[7]).replace(/\)\s*[\d.-]+\s*\(/g, "");
        const str = unescapePdf(raw);
        if (str) runs.push({ x, y, text: str, font, size });
      }
    }
  }
  return { pdf, runs, fonts };
}

/** Runs that don't fit the print area. The footer sits outside on purpose. */
function outOfMargin(runs, fonts) {
  return runs.filter((r) => {
    const str = r.text === "<next line>" ? "M" : r.text;
    const w = textWidth(fonts[r.font] || "Helvetica", r.size, str);
    const isFooter = /Impact OS|Thank you|Merci pour/.test(r.text);
    if (r.x + w > PAGE_W - M + TOL) return true; // past the right edge
    if (r.x < M - TOL) return true; // past the left edge
    if (r.y < M - TOL && !isFooter) return true; // below the bottom margin
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
  dimensions: Array.from({ length: 4 }, (_, i) => ({
    name: long(`Dimension ${i + 1} — capacité à structurer et documenter votre modèle économique`, 4),
    score: (i % 10) + 1,
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
    const linkLines = runs.filter((r) => r.text.includes("xxxx"));
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
