/**
 * Result email copy — the Founder Fit Score scope.
 *
 * Read as source, like result-pdf-on-approval.test.js: the property that must
 * not regress is SCOPE. The Founder Fit Score run gets its own message; every
 * other run keeps the neutral, form-agnostic copy. Because both go through one
 * sender, a lost flag would silently push the Founder Fit wording into every
 * run's result email — which is exactly what this protects.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const EMAIL = fs.readFileSync(path.join(ROOT, "src/lib/email.js"), "utf8");
const ROUTE = fs.readFileSync(path.join(ROOT, "src/app/api/platform/form-runs/route.js"), "utf8");

describe("result email copy — Founder Fit Score scope", () => {
  test("exactly two copies exist", () => {
    expect(EMAIL).toMatch(/function genericResultCopy\(/);
    expect(EMAIL).toMatch(/function founderFitResultCopy\(/);
  });

  test("the Founder Fit copy is the one with the score and the project", () => {
    expect(EMAIL).toMatch(/Votre Founder Fit Score est disponible/);
    expect(EMAIL).toMatch(/scoreText\} \/ 100/);
    expect(EMAIL).toMatch(/différenciation de \$\{project \|\| "votre projet"\}/);
  });

  test("the neutral copy keeps its original wording", () => {
    expect(EMAIL).toMatch(/Résultat de votre soumission/);
    expect(EMAIL).toMatch(/Veuillez trouver ci-joint le résultat de votre soumission/);
  });

  test("the sender picks the copy from the flag, defaulting to neutral", () => {
    expect(EMAIL).toMatch(/template === "founder_fit"/);
    expect(EMAIL).toMatch(/: genericResultCopy\(\{ isFr, greeting, frGreeting \}\);/);
  });

  test("both transports compose the same body", () => {
    expect(EMAIL).toMatch(/const compose = \(hosted, url = ""\) =>/);
    expect(EMAIL).toMatch(/html: compose\(false\)/);
    expect(EMAIL).toMatch(/html: compose\(true, url\)/);
  });

  test("a failed run/form read refuses the send instead of quietly going neutral", () => {
    // The classification read feeds the copy choice AND the document. Swallowing
    // its failure is what once let a wrong-but-plausible email go out with
    // nothing in the logs to explain it; a broken read must be loud, not a
    // silent downgrade to the neutral copy.
    const call = ROUTE.indexOf("await getRunFormContextBySubmissionId(submission_id)");
    expect(call).toBeGreaterThan(-1);
    const region = ROUTE.slice(call, call + 700);
    expect(region).not.toMatch(/catch \(_\) \{\}/);
    expect(region).toMatch(/console\.error/);
    expect(region).toMatch(/status: "failed"/);
    expect(region).toMatch(/if \(!ctx\)/);
  });

  test("a run is classified by its form name, with the run name as fallback", () => {
    expect(ROUTE).toMatch(/function isFounderFitResultRun\(ctx\)/);
    expect(ROUTE).toMatch(/form_name/);
    expect(ROUTE).toMatch(/run_name/);
    expect(ROUTE).toMatch(/template: isFounderFitResultRun\(ctx\) \? "founder_fit" : "generic"/);
  });

  test("the sender forwards the flag it was handed", () => {
    expect(ROUTE).toMatch(/projectName, template \} = resultDocument;/);
    expect(ROUTE).toMatch(/^\s+template,$/m);
  });

  test("the score and the project name are resolved where the answers are", () => {
    expect(ROUTE).toMatch(/resolveProjectName\(\{ submissionData: subData, fieldLabels: labels \}\)/);
    expect(ROUTE).toMatch(/score: finalScore != null \? Math\.round\(Number\(finalScore\)\) : null/);
  });
});
