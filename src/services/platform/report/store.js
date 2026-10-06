/**
 * Platform — Run output report: the store-backed composition (SERVICE layer).
 *
 * The one entry point the report builder uses — reuse a stored document while
 * the state and instruction are unchanged, otherwise compose and store it — plus
 * its two store helpers. The composed document is STORED
 * (platform_submission_reports) and reused while the Run state and the
 * instruction are unchanged, so preview and send yield identical bytes instead
 * of two independent model calls.
 *
 * Split of `services/platform/report.js` (see docs/LAYER_SPLIT.md): this is the
 * `store` slice; the barrel at the original path re-exports the same public
 * surface. The identity helpers and `MODEL` come from `./prompt`.
 *
 * Layer: decisions and orchestration, no SQL, no HTTP. It reads and writes
 * through `@/models/platform/ai/reportStore`.
 */

import {
  ensureSubmissionReportsTable,
  selectStoredReport,
  insertStoredReportRow,
} from "@/models/platform/ai/reportStore";
import {
  MAX_OUTPUT_INSTRUCTION,
  MAX_REFERENCE_TEXT,
  MODEL,
  capReference,
  composeReportDocument,
  hashInstruction,
  nonEmptyString,
  reportSourceKey,
} from "./prompt";

/**
 * The stored report matching the CURRENT key, or null.
 *
 * The key is deliberately exact: a changed instruction, a re-evaluated
 * submission or a new decision all produce a miss, so a stale document is never
 * rendered as if it were current. A miss simply composes a fresh one.
 */
export async function getStoredReport({ submissionId, evaluationId, decision, instructionHash, lang }) {
  await ensureSubmissionReportsTable();

  const result = await selectStoredReport({ submissionId, evaluationId, decision, instructionHash, lang });
  if (result.rows.length === 0) return null;

  let document = result.rows[0].document;
  if (typeof document === "string") {
    try {
      document = JSON.parse(document);
    } catch (_) {
      document = null;
    }
  }
  if (!document || !Array.isArray(document.sections)) return null;
  return { document, generatedAt: result.rows[0].generated_at };
}

/**
 * Persist a composed report, with what produced it for audit: the instruction
 * and the reference document as they were at that moment. Snapshotting both is
 * what lets a report that was already sent still be explained after the
 * instruction is edited and the attached document replaced or removed.
 */
export async function insertStoredReport({
  submissionId,
  evaluationId,
  decision,
  instructionHash,
  instructionSnapshot,
  referenceSnapshot,
  lang,
  document,
}) {
  await ensureSubmissionReportsTable();
  const result = await insertStoredReportRow({
    submissionId,
    evaluationId,
    decision,
    instructionHash,
    instructionSnapshot,
    referenceSnapshot,
    lang,
    document,
    model: MODEL,
  });
  return result.rows[0] || null;
}

/**
 * The one entry point the report builder uses.
 *
 * Returns the stored document when the current state already has one, otherwise
 * composes and stores it. `force` re-rolls the wording for an unchanged state
 * (the "Regenerate" affordance).
 *
 * Never throws: a failure comes back as `{ error }` so the caller can decide
 * whether to refuse the document rather than silently substituting another one.
 *
 * Both sources count: an attached document on its own is a complete brief, so the
 * composed report is used when EITHER the instruction or the reference text is
 * present. Neither → the caller keeps its deterministic output and no model call
 * is spent.
 *
 * @returns {Promise<{report: object|null, reused: boolean, generated: boolean, error?: string}>}
 */
export async function getOrCreateSubmissionReport({
  submissionId,
  evaluationId,
  decision,
  instruction,
  reference,
  referenceName,
  lang,
  payload,
  force = false,
}) {
  const trimmed = nonEmptyString(instruction);
  const referenceText = capReference(reference);
  if (!trimmed && !referenceText) return { report: null, reused: false, generated: false };

  // The key covers the reference too — a replaced document must not leave an
  // older report looking current.
  const instructionHash = hashInstruction(reportSourceKey(trimmed, referenceText));

  if (!force) {
    const stored = await getStoredReport({ submissionId, evaluationId, decision, instructionHash, lang });
    if (stored) return { report: stored.document, reused: true, generated: false, generatedAt: stored.generatedAt };
  }

  try {
    const document = await composeReportDocument({
      instruction: trimmed,
      reference: referenceText,
      referenceName,
      lang,
      payload,
    });
    if (!document) {
      return { report: null, reused: false, generated: false, error: "the AI returned a report that could not be read" };
    }
    const row = await insertStoredReport({
      submissionId,
      evaluationId,
      decision,
      instructionHash,
      instructionSnapshot: trimmed.slice(0, MAX_OUTPUT_INSTRUCTION),
      lang,
      referenceSnapshot: referenceText ? referenceText.slice(0, MAX_REFERENCE_TEXT) : null,
      document,
    });
    return { report: document, reused: false, generated: true, generatedAt: row?.generated_at ?? null };
  } catch (error) {
    console.error("[Report] Composition failed:", error?.message || error);
    return { report: null, reused: false, generated: false, error: error?.message || "report composition failed" };
  }
}
