/**
 * The form-runs action DECISIONS, now in the service layer.
 *
 * The controller frontier moved the whole write half of `/api/platform/form-runs`
 * into `services/platform/formRuns` (see docs/LAYER_SPLIT.md, slices 103–110).
 * The source-pins next to this file keep the ORDER/REUSE invariants readable as
 * text; this net exercises the decisions themselves with the repository mocked,
 * so a future edit cannot silently change what each action decides.
 *
 * What is pinned here:
 *   1. The run-status vocabulary (the controller validates against it).
 *   2. `assignRunTargets` — the target-type allowlist refuses an empty list.
 *   3. `updateRunMetadata` — the Output-Instruction rules (a string, bounded,
 *      stored trimmed; absent passes through untouched).
 *   4. `submitResponse` — the run gate (not found / not active).
 *   5. `processReviewInternal` — idempotency and the "PDF needs an evaluation"
 *      refusal, both of which must happen before any side effect.
 */
jest.mock("@/lib/platform/automation", () => ({
  onAssignmentAdded: jest.fn(),
  onReview: jest.fn(),
  onRunCreated: jest.fn(),
  onRunLaunched: jest.fn(),
  onSubmission: jest.fn(),
  sendAcknowledgementForSubmission: jest.fn(),
}));

jest.mock("@/models/formRuns", () => ({
  getRunSubmissionGateById: jest.fn(),
  getSubmissionReviewStateById: jest.fn(),
  getLatestEvaluationBySubmissionId: jest.fn(),
  updateFormRunMetadataById: jest.fn(),
  insertRunAssignmentForAction: jest.fn(),
  getAssignmentsAfterAssignByRunId: jest.fn(),
  getFullRunAfterAssignById: jest.fn(),
  insertTimelineEntry: jest.fn(),
}));

const { onAssignmentAdded } = require("@/lib/platform/automation");
const models = require("@/models/formRuns");
const { MAX_OUTPUT_INSTRUCTION } = require("@/models/platform/ai/report");
const {
  RUN_STATUSES,
  isValidRunStatus,
  ASSIGNMENT_TARGET_TYPES,
  assignRunTargets,
  updateRunMetadata,
  submitResponse,
  processReviewInternal,
} = require("@/services/platform/formRuns");

const session = { cid: "USR_REVIEWER", email: "reviewer@example.com" };

beforeEach(() => {
  jest.clearAllMocks();
  models.getAssignmentsAfterAssignByRunId.mockResolvedValue({ rows: [] });
  models.getFullRunAfterAssignById.mockResolvedValue({ rows: [] });
  models.insertTimelineEntry.mockResolvedValue({});
});

describe("the run-status vocabulary", () => {
  test("accepts exactly the six lifecycle statuses", () => {
    expect(RUN_STATUSES).toEqual(["draft", "scheduled", "active", "closed", "cancelled", "archived"]);
    for (const status of RUN_STATUSES) expect(isValidRunStatus(status)).toBe(true);
  });

  test("refuses anything else", () => {
    for (const bad of ["", "published", "ACTIVE", null, undefined, 3]) {
      expect(isValidRunStatus(bad)).toBe(false);
    }
  });
});

describe("assignRunTargets", () => {
  test("the audience allowlist is the documented set", () => {
    expect(ASSIGNMENT_TARGET_TYPES).toEqual([
      "user",
      "group",
      "program",
      "cohort",
      "team",
      "organization",
      "all",
    ]);
  });

  test("an unknown target type is refused without touching the repository", async () => {
    const result = await assignRunTargets({
      run_id: 1,
      targets: [{ target_type: "planet", target_id: 9 }],
      session,
    });
    expect(result).toEqual({ ok: false, error: "run_id and target required" });
    expect(models.insertRunAssignmentForAction).not.toHaveBeenCalled();
  });

  test("a valid target is inserted and the assignment automation fires", async () => {
    models.insertRunAssignmentForAction.mockResolvedValue({ rowsAffected: 1 });

    const result = await assignRunTargets({
      run_id: 7,
      target_type: "user",
      target_id: "USR_1",
      session,
    });

    expect(result).toEqual({ ok: true, added: 1, skipped: 0, assignments: [] });
    expect(models.insertRunAssignmentForAction).toHaveBeenCalledWith({
      runId: 7,
      targetType: "user",
      targetId: "USR_1",
      assignedBy: session.cid,
    });
    expect(onAssignmentAdded).toHaveBeenCalledTimes(1);
  });

  test("an already-present target counts as skipped, not added", async () => {
    models.insertRunAssignmentForAction.mockResolvedValue({ rowsAffected: 0 });

    const result = await assignRunTargets({
      run_id: 7,
      target_type: "group",
      target_id: "GRP_1",
      session,
    });

    expect(result).toEqual({ ok: true, added: 0, skipped: 1, assignments: [] });
    expect(onAssignmentAdded).not.toHaveBeenCalled();
  });
});

describe("updateRunMetadata — the Output Instruction", () => {
  const update = (settings) => updateRunMetadata({ id: 3, settings });

  test("a non-string instruction is refused with the UI key", async () => {
    await expect(update({ output_instruction: 42 })).resolves.toEqual({
      ok: false,
      statusCode: 400,
      error: "platformMisc.runs.outputInstructionInvalid",
    });
    expect(models.updateFormRunMetadataById).not.toHaveBeenCalled();
  });

  test("an over-long instruction is refused with the UI key", async () => {
    await expect(update({ output_instruction: "x".repeat(MAX_OUTPUT_INSTRUCTION + 1) })).resolves.toEqual({
      ok: false,
      statusCode: 400,
      error: "platformMisc.runs.outputInstructionTooLong",
    });
    expect(models.updateFormRunMetadataById).not.toHaveBeenCalled();
  });

  test("a valid instruction is stored trimmed", async () => {
    models.updateFormRunMetadataById.mockResolvedValue({ rows: [{ id: 3 }] });

    const result = await update({ output_instruction: "  Write a summary.  " });

    expect(result).toEqual({ ok: true, run: { id: 3 } });
    expect(models.updateFormRunMetadataById).toHaveBeenCalledWith(
      expect.objectContaining({ settings: { output_instruction: "Write a summary." } }),
    );
  });

  test("a whitespace-only instruction becomes an empty string, never a blank prompt", async () => {
    models.updateFormRunMetadataById.mockResolvedValue({ rows: [{ id: 3 }] });

    await update({ output_instruction: "   " });

    expect(models.updateFormRunMetadataById).toHaveBeenCalledWith(
      expect.objectContaining({ settings: { output_instruction: "" } }),
    );
  });

  test("an absent instruction passes settings through untouched", async () => {
    models.updateFormRunMetadataById.mockResolvedValue({ rows: [{ id: 3 }] });

    await update({ output_instruction: undefined, report_file: "kept" });

    expect(models.updateFormRunMetadataById).toHaveBeenCalledWith(
      expect.objectContaining({ settings: { report_file: "kept" } }),
    );
  });
});

describe("submitResponse — the run gate", () => {
  test("an unknown run is a 404", async () => {
    models.getRunSubmissionGateById.mockResolvedValue({ rows: [] });

    await expect(submitResponse({ run_id: 99, data: {}, session })).resolves.toEqual({
      ok: false,
      statusCode: 404,
      error: "Run not found",
    });
  });

  test("a non-active run refuses the submit", async () => {
    models.getRunSubmissionGateById.mockResolvedValue({ rows: [{ status: "closed", settings: {} }] });

    await expect(submitResponse({ run_id: 99, data: {}, session })).resolves.toEqual({
      ok: false,
      statusCode: 400,
      error: "Run is not active",
    });
  });
});

describe("processReviewInternal — the guards before any side effect", () => {
  const runReview = (overrides = {}) =>
    processReviewInternal({
      submission_id: 5,
      decision: "approved",
      comment: "",
      session,
      after: jest.fn(),
      scheduleResultSweep: jest.fn(),
      ...overrides,
    });

  test("an unknown submission is a 404", async () => {
    models.getSubmissionReviewStateById.mockResolvedValue({ rows: [] });
    await expect(runReview()).resolves.toEqual({ ok: false, statusCode: 404, error: "Submission not found" });
  });

  test("a re-approval is idempotent — nothing is written or sent", async () => {
    const submission = { id: 5, status: "approved" };
    models.getSubmissionReviewStateById.mockResolvedValue({ rows: [submission] });

    await expect(runReview()).resolves.toEqual({ ok: true, already_approved: true, submission });
    // The short-circuit runs before the review row, the status change and the email,
    // so no timeline entry (the side effect that follows the status change) is written.
    expect(models.insertTimelineEntry).not.toHaveBeenCalled();
  });

  test("requesting the result PDF without an evaluation refuses before any side effect", async () => {
    models.getSubmissionReviewStateById.mockResolvedValue({ rows: [{ id: 5, status: "submitted" }] });
    models.getLatestEvaluationBySubmissionId.mockResolvedValue({ rows: [] });

    await expect(runReview({ includeResultPdf: true })).resolves.toEqual({
      ok: false,
      statusCode: 409,
      errorCode: "result_pdf_not_evaluated",
      error: expect.stringContaining("No AI result yet"),
    });
    // The refusal is above the review row, so nothing was written.
    expect(models.insertTimelineEntry).not.toHaveBeenCalled();
  });
});
