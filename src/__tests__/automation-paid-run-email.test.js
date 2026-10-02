/**
 * A PAID Execution mints NO email on submission.
 *
 * The submission only CAPTURES a registration — the money is not confirmed yet,
 * so an acknowledgement would announce a course the person has not paid for. The
 * receipt and the access link go out from the payment confirmation (the checkout
 * webhook), and only then; an unpaid registration sends nothing at all.
 *
 * This suite pins the SUBMISSION_RECEIVED rule: it must stay silent for a run
 * linked to a course, and behave exactly as before for a free run.
 */

jest.mock("@/models/platform/integrations", () => ({
  audit: jest.fn(async () => {}),
  notifyUser: jest.fn(async () => {}),
}));

jest.mock("@/models/platform/roles", () => ({ resolveDefaultRole: jest.fn(() => "participant") }));
jest.mock("@/lib/identity", () => ({ stopRoleMutationEnabled: jest.fn(() => false) }));
jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash:${token}` }));

jest.mock("@/lib/email", () => ({
  resolveSubmissionEmail: jest.fn(() => "payer@example.com"),
  resolvePersonName: jest.fn(() => "Payer"),
  getTemplate: jest.fn(() => ({})),
  sendTrackedEmail: jest.fn(async () => ({ success: true })),
  sendConfirmationEmail: jest.fn(async () => ({ success: true, provider: "gmail" })),
}));

jest.mock("@/models/formRuns", () => ({
  getDecisionEmailSubmissionById: jest.fn(async () => ({
    rows: [
      {
        data: { "f-email": "payer@example.com" },
        run_id: 1,
        submitter_id: "USR-1",
        submitter_name: "Payer",
      },
    ],
  })),
  getFieldLabelsByRunId: jest.fn(async () => ({ rows: [] })),
  getContactNameEmailByCid: jest.fn(async () => ({ rows: [] })),
  getRunTemplateSettingsForDecisionById: jest.fn(async () => ({ rows: [] })),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
  initDb: jest.fn(async () => {}),
}));

const { sendTrackedEmail } = require("@/lib/email");
const { PLATFORM_EVENTS, fireEvent } = require("@/models/platform/automation");

const SUBMISSION = {
  id: "SUB-1",
  run_id: 1,
  status: "submitted",
  submitter_id: "USR-1",
  submitter_name: "Payer",
  data: { "f-email": "payer@example.com" },
};

beforeEach(() => jest.clearAllMocks());

describe("SUBMISSION_RECEIVED automation", () => {
  test("a free Execution still acknowledges the submission", async () => {
    await fireEvent(PLATFORM_EVENTS.SUBMISSION_RECEIVED, {
      submission: SUBMISSION,
      run: { id: 1, name: "Free form" },
      form: null,
    });

    expect(sendTrackedEmail).toHaveBeenCalled();
  });

  test("a PAID Execution (run linked to a course) sends NOTHING on submission", async () => {
    await fireEvent(PLATFORM_EVENTS.SUBMISSION_RECEIVED, {
      submission: SUBMISSION,
      run: { id: 1, name: "Paid course", lms_course_id: "COURSE-1" },
      form: null,
    });

    expect(sendTrackedEmail).not.toHaveBeenCalled();
  });
});
