/**
 * "Also send the AI result PDF" — the invariants that must not regress.
 *
 * Read as source, the way identity-gate-bridge.test.js reads the converted
 * handlers: the important properties here are ORDER and REUSE, which a mocked
 * unit test would not actually protect.
 *
 *   1. The refusal happens BEFORE any side effect. If the gate ever drifts below
 *      `createSubmissionReview`, a reviewer could tick the PDF, get refused, and
 *      still find the submission approved with an email already sent.
 *   2. The document the applicant receives is the one from "Send Response" —
 *      the same function, not a second implementation that can drift.
 *   3. Both entry points (single review, bulk review) forward the flag.
 *
 * The workflow itself now lives in `services/platform/formRuns`
 * (processReviewInternal); the controller keeps the two review actions and
 * injects `after` / `scheduleResultSweep`. So the order/reuse assertions read the
 * SERVICE, and the entry-point/flag-forwarding assertions read the ROUTE —
 * same properties, new homes (see docs/LAYER_SPLIT.md).
 */
const fs = require("fs");
const path = require("path");
const { readSurface } = require("./helpers/sourceSurface");

const ROOT = path.resolve(__dirname, "..", "..");
const SERVICE = "src/services/platform/formRuns.js";
// The route handlers are now split; read both review and bulk_review handlers
const reviewSrc = readSurface("src/app/api/platform/form-runs/handlers/post/review.js");
const bulkReviewSrc = readSurface("src/app/api/platform/form-runs/handlers/post/bulk_review.js");
const src = reviewSrc + "\n" + bulkReviewSrc;
// The service is split across `formRuns/`; read the whole surface so the
// order/reuse pins cover the same bytes wherever the code lives.
const serviceSrc = readSurface(SERVICE);

const serviceIndexOf = (needle) => serviceSrc.indexOf(needle);

describe("AI result PDF on approval — server invariants", () => {
  test("the refusal is a 409 with a stable code, and it names itself", () => {
    expect(serviceSrc).toMatch(/errorCode:\s*"result_pdf_not_evaluated"/);
    expect(serviceSrc).toMatch(/statusCode:\s*409/);
  });

  test("the gate runs BEFORE the review row is written", () => {
    const gate = serviceIndexOf('errorCode: "result_pdf_not_evaluated"');
    const firstSideEffect = serviceIndexOf("await createSubmissionReview({");
    expect(gate).toBeGreaterThan(-1);
    expect(firstSideEffect).toBeGreaterThan(-1);
    // Order is the whole point: no side effect may precede the refusal.
    expect(gate).toBeLessThan(firstSideEffect);
  });

  test("the gate runs before the status change and before any email", () => {
    const gate = serviceIndexOf('errorCode: "result_pdf_not_evaluated"');
    expect(gate).toBeLessThan(serviceIndexOf("await updateSubmissionStatusById("));
    expect(gate).toBeLessThan(serviceIndexOf("await sendDecisionEmailForSubmission("));
  });

  test("the gate only applies to an approval — a rejection ignores the flag", () => {
    expect(serviceSrc).toMatch(/if \(includeResultPdf && decision === "approved"\) \{/);
  });

  test("the PDF reuses the Send Response path instead of a second implementation", () => {
    // The only PDF sender is sendResultEmailForSubmission; the approval flow
    // must call it rather than build/send a document of its own. One build site
    // in the whole run-email service is the invariant — a second one would drift.
    // Every caller (approval, scheduled dispatcher, retries, bulk result send)
    // now lives in the service alongside the single build site.
    expect((serviceSrc.match(/await sendResultEmailForSubmission\(/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((serviceSrc.match(/buildSubmissionResultPdf\(\{/g) || []).length).toBe(1);
  });

  test("the PDF send is guarded by the same approval condition", () => {
    const send = serviceIndexOf("resultPdf = await sendResultEmailForSubmission({ submission_id });");
    expect(send).toBeGreaterThan(-1);
    const guard = serviceSrc.lastIndexOf('if (includeResultPdf && decision === "approved") {', send);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(send);
  });

  test("both review entry points forward the flag", () => {
    const forwards = (src.match(/includeResultPdf: include_result_pdf === true/g) || []).length;
    expect(forwards).toBe(2);
    expect(src).toMatch(/const \{ submission_id, decision, comment, internal_note, dimension_overrides, force, include_result_pdf \} = await req\.json\(\);/);
    expect(src).toMatch(/const \{ run_id, submission_ids, decision, comment, include_result_pdf \} = await req\.json\(\);/);
  });

  test("the outcome is reported back to the caller", () => {
    expect(serviceSrc).toMatch(/result_pdf: resultPdf \};/);
    expect(src).toMatch(/result_pdf: reviewResult\.result_pdf \|\| null/);
    expect(src).toMatch(/result_pdf_error: reviewResult\.result_pdf \? reviewResult\.result_pdf\.error : undefined/);
  });

  test("the refusal never sends a half-done decision email", () => {
    // Before the refusal existed the decision email ran unconditionally; the
    // early return must sit above it so nothing leaves on a refused approval.
    const refusalReturn = serviceSrc.indexOf('error: "No AI result yet');
    const decisionEmail = serviceIndexOf("await sendDecisionEmailForSubmission({ submission_id, decision, comment: comment || \"\" });");
    expect(refusalReturn).toBeGreaterThan(-1);
    expect(refusalReturn).toBeLessThan(decisionEmail);
  });
});
