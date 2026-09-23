/**
 * THE EVALUATION WAS RUNNING WHEN NOBODY ASKED.
 *
 * Two independent defects, one symptom: the AI score moved on a refresh and
 * burned a model call every time.
 *
 * 1. `hasEvaluation(formId)` was named as if it answered "has this submission
 *    been evaluated?" but actually answered "is AI switched on for this form?".
 *    The submit path used it as an existence check, so every re-save of an
 *    already-evaluated response ran the model again and appended another
 *    evaluation row.
 *
 * 2. The review page auto-triggered an evaluation on every mount, so merely
 *    opening or refreshing the page spent a call — and the fresh row it wrote
 *    carried no human values, which is how a reviewer's entered scores silently
 *    disappeared from view.
 *
 * The rule these tests enforce: **a page load is a read.** It never runs the
 * model, never appends a row, and never spends a token. Only a submission
 * (once) and an explicit human click may evaluate.
 */
const fs = require("fs");
const path = require("path");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

const REVIEW_PAGE = "src/app/platform/runs/review/[submissionId]/page.js";
const FORM_RUNS = "src/app/api/platform/form-runs/route.js";
const EVALUATE = "src/models/platform/ai/evaluate.js";

let mockFrameworkRows = [];
let mockFormRows = [];
let mockEvaluationRows = [];
const mockQueries = [];

const mockDb = {
  execute: jest.fn(async ({ sql, args }) => {
    const text = String(sql);
    mockQueries.push({ text, args });
    if (text.includes("platform_evaluation_frameworks")) return { rows: mockFrameworkRows };
    if (text.includes("platform_forms")) return { rows: mockFormRows };
    if (text.includes("platform_submission_evaluations")) return { rows: mockEvaluationRows };
    return { rows: [] };
  }),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/deepseek", () => ({
  deepseekIntelligence: { chat: jest.fn() },
  default: { chat: jest.fn() },
}));

const {
  formHasAiEvaluation,
  submissionHasEvaluation,
  evaluateSubmission,
} = require("@/models/platform/ai/evaluate");

beforeEach(() => {
  mockFrameworkRows = [];
  mockFormRows = [];
  mockEvaluationRows = [];
  mockQueries.length = 0;
  mockDb.execute.mockClear();
});

const SWITCH_ON = [{ settings: { ai_evaluation: true } }];
const SWITCH_OFF = [{ settings: { ai_evaluation: false } }];
const HAS_FRAMEWORK = [{ 1: 1 }];

describe("the two questions are different questions", () => {
  test('"is AI switched on for this FORM?" — on', async () => {
    mockFrameworkRows = HAS_FRAMEWORK;
    mockFormRows = SWITCH_ON;
    expect(await formHasAiEvaluation(5)).toBe(true);
  });

  test('"is AI switched on for this FORM?" — switched off', async () => {
    mockFrameworkRows = HAS_FRAMEWORK;
    mockFormRows = SWITCH_OFF;
    expect(await formHasAiEvaluation(5)).toBe(false);
  });

  test('"is AI switched on for this FORM?" — no framework configured', async () => {
    mockFrameworkRows = [];
    mockFormRows = SWITCH_ON;
    expect(await formHasAiEvaluation(5)).toBe(false);
  });

  test('"has THIS SUBMISSION been evaluated?" — yes', async () => {
    mockEvaluationRows = [{ 1: 1 }];
    expect(await submissionHasEvaluation(77)).toBe(true);
    // It must ask about the submission, not the form.
    const query = mockQueries.find((entry) => entry.text.includes("platform_submission_evaluations"));
    expect(query.args).toEqual([77]);
  });

  test('"has THIS SUBMISSION been evaluated?" — no', async () => {
    mockEvaluationRows = [];
    expect(await submissionHasEvaluation(77)).toBe(false);
  });

  test("the form question never reads submissions, and vice versa", async () => {
    mockFrameworkRows = HAS_FRAMEWORK;
    mockFormRows = SWITCH_ON;
    await formHasAiEvaluation(5);
    expect(mockQueries.some((entry) => entry.text.includes("platform_submission_evaluations"))).toBe(false);

    mockQueries.length = 0;
    mockEvaluationRows = [{ 1: 1 }];
    await submissionHasEvaluation(77);
    // The submission question is answerable without knowing the form at all —
    // which is exactly why confusing the two produced duplicate evaluations.
    expect(mockQueries.some((entry) => entry.text.includes("platform_evaluation_frameworks"))).toBe(false);
  });
});

describe("the misleading name is gone, not aliased", () => {
  test("no export shadows the question with the wrong answer", () => {
    const src = read(EVALUATE);
    expect(src).not.toMatch(/export async function hasEvaluation\b/);
    expect(src).toContain("export async function formHasAiEvaluation");
    expect(src).toContain("export async function submissionHasEvaluation");
  });

  test("both are reachable, and the old name is not", () => {
    expect(typeof formHasAiEvaluation).toBe("function");
    expect(typeof submissionHasEvaluation).toBe("function");
    expect(typeof evaluateSubmission).toBe("function");
  });
});

describe("a re-saved response is never re-evaluated", () => {
  test("the submit path asks the per-submission question before spending a call", () => {
    const src = read(FORM_RUNS);
    // The update branch must verify against THIS submission...
    expect(src).toMatch(/submissionHasEvaluation\(newSubmissionId\)/);
    // ...and the old name must be gone from every call site.
    expect(src).not.toMatch(/\bhasEvaluation\(/);
    expect(src).not.toContain("shouldEvaluate");
  });

  test("an unanswerable check skips the call rather than risking a duplicate", () => {
    // `.catch(() => true)` = "assume already evaluated" = do not spend a call.
    expect(read(FORM_RUNS)).toContain(".catch(() => true)");
  });
});

describe("a page load cannot run the model", () => {
  test("the review page's load no longer carries an evaluate POST", () => {
    const src = read(REVIEW_PAGE);
    // The removed auto-trigger's variable must not come back.
    expect(src).not.toContain("triggerRes");
    expect(src).not.toContain("else if (canReview)");
    // Only the deliberate button may POST an evaluation.
    const posts = src.match(/evaluate-submission",\s*\{\s*method: "POST"/g) || [];
    expect(posts).toHaveLength(1);
  });

  test("no read is keyed on the reviewer's permissions, so arriving ones cannot re-run it", () => {
    const src = read(REVIEW_PAGE);
    // The reads are addressed by the submission, and by what that answer names.
    expect(src).toContain("deps: [submissionId]");
    // `canReview` decides whether the action is OFFERED; it must never decide what
    // is read. A permission that arrives late would otherwise re-issue every read.
    expect(src).not.toMatch(/deps:\s*\[[^\]]*canReview/);
    expect(src).not.toContain("submissionId, canReview");
  });
});
