/**
 * Characterisation tests for POST/GET /api/platform/ai/evaluate-submission.
 *
 * Pins the evaluation decisions — the progress read, the claim→evaluate→release
 * batch, the `force` re-evaluate and the GET shapes — rather than the
 * implementation, so the suite stays valid after the batch model moves to
 * `@/services/platform/evaluation`. The model and AI layers are mocked.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn(async () => null),
}));

jest.mock("@/lib/email", () => ({
  getEmailStatsForForm: jest.fn(async () => ({ sent: 1, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 })),
}));

const mockEval = {
  evaluateSubmission: jest.fn(),
  formHasAiEvaluation: jest.fn(),
  getEvaluation: jest.fn(),
};
jest.mock("@/lib/platform/ai/evaluate", () => mockEval);

jest.mock("@/models/platform/ai/autoApprove", () => ({
  maybeAutoApprove: jest.fn(async () => ({})),
}));

const mockAi = {
  claimEvaluationSubmission: jest.fn(),
  countApprovalDecisionsForForm: jest.fn(),
  countProgressEvaluatedSubmissions: jest.fn(),
  countProgressFailedSubmissions: jest.fn(),
  countProgressTotalSubmissions: jest.fn(),
  createEvaluationClaimsTable: jest.fn(),
  createEvaluationFailuresTable: jest.fn(),
  deleteEvaluationFailureRecord: jest.fn(),
  deleteEvaluationsForSubmission: jest.fn(),
  deleteExpiredEvaluationClaims: jest.fn(),
  findEvaluationBatchCandidates: jest.fn(),
  recordEvaluationFailure: jest.fn(),
  releaseEvaluationClaim: jest.fn(),
  resetEvaluationFailuresForSubmission: jest.fn(),
};
jest.mock("@/models/platformAi", () => mockAi);

const { maybeAutoApprove } = require("@/models/platform/ai/autoApprove");
const { POST, GET } = require("@/app/api/platform/ai/evaluate-submission/route");

const postReq = (body) =>
  new Request("http://localhost/api/platform/ai/evaluate-submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const readJson = (res) => res.json();

beforeEach(() => {
  jest.clearAllMocks();
  mockEval.evaluateSubmission.mockResolvedValue({ overall_score: 42 });
  mockAi.countProgressTotalSubmissions.mockResolvedValue({ rows: [{ cnt: 10 }] });
  mockAi.countProgressEvaluatedSubmissions.mockResolvedValue({ rows: [{ cnt: 4 }] });
  mockAi.countProgressFailedSubmissions.mockResolvedValue({ rows: [{ cnt: 1 }] });
  mockAi.countApprovalDecisionsForForm.mockResolvedValue({
    rows: [{ status: "approved", cnt: 2 }, { status: "rejected", cnt: 1 }],
  });
  mockAi.findEvaluationBatchCandidates.mockResolvedValue({ rows: [] });
});

describe("POST progress", () => {
  test("reports the counts and the approval/email stats, and runs nothing", async () => {
    const res = await POST(postReq({ action: "progress", form_id: 5 }));
    const data = await readJson(res);

    expect(res.status).toBe(200);
    expect(data.progress).toEqual({ total: 10, evaluated: 4, failed: 1, remaining: 5, percent: 40 });
    expect(data.approvals).toEqual({ approved: 2, rejected: 1 });
    expect(mockEval.evaluateSubmission).not.toHaveBeenCalled();
  });
});

describe("POST batch", () => {
  test("claims, evaluates and releases each candidate, then reports progress", async () => {
    mockAi.findEvaluationBatchCandidates.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    mockAi.claimEvaluationSubmission
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 2 }] });

    const res = await POST(postReq({ action: "batch", form_id: 5, batch_size: 2 }));
    const data = await readJson(res);

    expect(res.status).toBe(200);
    expect(data.processed).toBe(2);
    expect(data.evaluated).toBe(2);
    expect(mockAi.releaseEvaluationClaim).toHaveBeenCalledTimes(2);
    expect(mockAi.deleteExpiredEvaluationClaims).toHaveBeenCalled();
  });

  test("a submission that fails to evaluate is recorded and counted as failed", async () => {
    mockAi.findEvaluationBatchCandidates.mockResolvedValue({ rows: [{ id: 1 }] });
    mockAi.claimEvaluationSubmission.mockResolvedValue({ rows: [{ id: 1 }] });
    mockEval.evaluateSubmission.mockResolvedValue(null);

    const res = await POST(postReq({ action: "batch", form_id: 5 }));
    const data = await readJson(res);

    expect(data.failed).toBe(1);
    expect(mockAi.recordEvaluationFailure).toHaveBeenCalled();
  });
});

describe("POST single", () => {
  test("a missing submission_id is refused (400)", async () => {
    const res = await POST(postReq({ form_id: 5 }));
    expect(res.status).toBe(400);
    expect(mockEval.evaluateSubmission).not.toHaveBeenCalled();
  });

  test("a plain evaluation scores the submission and auto-approves by cutoff", async () => {
    const res = await POST(postReq({ submission_id: 9 }));
    const data = await readJson(res);
    expect(res.status).toBe(200);
    expect(data.evaluation).toEqual({ overall_score: 42 });
    expect(maybeAutoApprove).toHaveBeenCalledWith(9, { overall_score: 42 });
    expect(mockAi.deleteEvaluationsForSubmission).not.toHaveBeenCalled();
  });

  test("force clears the prior evaluation and failure first", async () => {
    const res = await POST(postReq({ submission_id: 9, force: true }));
    const data = await readJson(res);
    expect(data.re_evaluated).toBe(true);
    expect(mockAi.deleteEvaluationsForSubmission).toHaveBeenCalledWith(9);
    expect(mockAi.resetEvaluationFailuresForSubmission).toHaveBeenCalledWith(9);
  });

  test("a null evaluation answer is a 400", async () => {
    mockEval.evaluateSubmission.mockResolvedValue(null);
    const res = await POST(postReq({ submission_id: 9 }));
    expect(res.status).toBe(400);
  });
});

describe("GET", () => {
  test("needs one of form_id / submission_id (400)", async () => {
    const res = await GET(new Request("http://localhost/api/platform/ai/evaluate-submission"));
    expect(res.status).toBe(400);
  });

  test("by submission_id returns the evaluation", async () => {
    mockEval.getEvaluation.mockResolvedValue({ overall_score: 7 });
    const res = await GET(
      new Request("http://localhost/api/platform/ai/evaluate-submission?submission_id=9"),
    );
    const data = await readJson(res);
    expect(data.evaluation).toEqual({ overall_score: 7 });
  });

  test("by form_id answers the form-scoped question", async () => {
    mockEval.formHasAiEvaluation.mockResolvedValue(true);
    const res = await GET(
      new Request("http://localhost/api/platform/ai/evaluate-submission?form_id=5"),
    );
    const data = await readJson(res);
    expect(data.has_evaluation).toBe(true);
  });
});
