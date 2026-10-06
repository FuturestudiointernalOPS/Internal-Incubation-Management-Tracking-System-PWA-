/**
 * RUN OUTPUT REPORT — AI COMPOSITION LAYER
 *
 * A Run's final report is normally laid out by the fixed renderer in
 * `resultPdf.js` from the Run's own data. When the Run carries an optional
 * Output Instruction (`platform_form_runs.settings.output_instruction`) and/or
 * one attached document (`platform_run_report_files`), this module asks the
 * model to write the report from that same Run data, shaped by whatever the
 * administrator supplied — tone, structure, wording, presentation.
 *
 * Either source is enough on its own: an attached document may already state
 * every requirement the report needs. The document reaches this module as TEXT
 * (it is read out of the file elsewhere) and takes part in the report's identity
 * — see `reportSourceKey`.
 *
 * Two rules make this safe to hang off an existing workflow:
 *
 *   1. The Run stays the source of truth. The model receives the answers, the
 *      computed scores, the ranking and the decision as DATA, and is told never
 *      to invent or recompute anything. Scoring is untouched.
 *
 *   2. The composed document is STORED (platform_submission_reports) and reused
 *      while the Run state and instruction are unchanged. Preview and Send both
 *      call the builder, so storing is what keeps the previewed document and the
 *      sent document identical instead of two independent model calls.
 *
 * Platform guardrails live in the SYSTEM message so that neither the
 * administrator's instruction nor the applicant's answers can override them.
 *
 * Split (see docs/LAYER_SPLIT.md): the code lives in `./report/` — the pure
 * `prompt` helpers/parser and the `store`-backed composition. This file
 * re-exports the same public surface, so importers and tests are unchanged.
 *
 * Layer: the decisions live here; every statement lives in
 * `@/models/platform/ai/reportStore`.
 */

export {
  MAX_OUTPUT_INSTRUCTION,
  MAX_REFERENCE_TEXT,
  hashInstruction,
  capReference,
  reportSourceKey,
  stripMarkdown,
  parseReportDocument,
  buildReportPrompt,
  composeReportDocument,
} from "./report/prompt";
export {
  getStoredReport,
  insertStoredReport,
  getOrCreateSubmissionReport,
} from "./report/store";
