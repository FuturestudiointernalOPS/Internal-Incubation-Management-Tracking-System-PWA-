/**
 * Approving a submission must not de-activate an account that is already active.
 *
 * The approval automation decides between "send a password-setup email" and
 * "send a login link" from the person's CURRENT account state, and it rewrites
 * the status to "approved" only for a person who has not activated yet. The
 * lookup that fed that decision omitted the status, so every existing account
 * looked un-activated: each approval demoted an active account back to
 * "approved". Program participant lists only count active accounts, so an
 * approved applicant who had already activated silently disappeared from the
 * program they were enrolled in.
 *
 * These tests pin both directions:
 *   - an active account keeps its status and receives a login link,
 *   - a not-yet-activated account is approved and receives a setup link.
 */

jest.mock("@/models/platform/integrations", () => ({
  audit: jest.fn(async () => {}),
  notifyUser: jest.fn(async () => {}),
}));

jest.mock("@/models/platform/roles", () => ({ resolveDefaultRole: jest.fn(() => "member") }));
jest.mock("@/lib/identity", () => ({ stopRoleMutationEnabled: jest.fn(() => false) }));
jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash:${token}` }));

jest.mock("@/lib/email", () => ({
  resolveSubmissionEmail: jest.fn(() => "abel@example.com"),
  resolveRecipientEmail: jest.fn(({ contactEmail }) => contactEmail),
  resolvePersonName: jest.fn(() => "Abel"),
  detectLanguage: jest.fn(() => "fr"),
  decideEmailKind: jest.fn(({ accountExists, accountActivated }) =>
    !accountExists ? "create_activate" : accountActivated ? "login_existing" : "activate_existing",
  ),
  getTemplate: jest.fn(() => ({})),
  getEmailLogRow: jest.fn(async () => null),
  hasSentEmailToRecipientInRun: jest.fn(async () => false),
  recordEmailStatus: jest.fn(async () => {}),
  recordEmailFailure: jest.fn(async () => {}),
  sendTrackedEmail: jest.fn(async ({ sendFn } = {}) => {
    if (typeof sendFn === "function") await sendFn();
    return { success: true };
  }),
  sendConfirmationEmail: jest.fn(async () => ({ success: true })),
  sendInviteEmail: jest.fn(async () => ({ success: true })),
  sendLoginEmail: jest.fn(async () => ({ success: true })),
  ensurePasswordSetupTokensSchema: jest.fn(async () => {}),
}));

const mockDb = {
  execute: jest.fn(),
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: mockDb,
  initDb: jest.fn(async () => {}),
}));

const { sendInviteEmail, sendLoginEmail, decideEmailKind } = require("@/lib/email");
const { PLATFORM_EVENTS, fireEvent } = require("@/models/platform/automation");

const sqlOf = (statement) =>
  typeof statement === "string" ? statement : String(statement?.sql || "");

/**
 * A real driver returns ONLY the columns a SELECT names. Projecting here (like
 * the fake LMS database does) is what makes a lookup that forgets a column
 * fail the test instead of silently returning it anyway.
 */
function project(row, sql) {
  const match = /^\s*select\s+(.+?)\s+from\s/i.exec(sql);
  if (!match) return { ...row };
  const list = match[1].trim();
  if (list === "*" || list.includes("*")) return { ...row };
  const projected = {};
  for (const entry of list.split(",")) {
    const column = entry.trim().replace(/::\w+$/, "").split(".").pop();
    projected[column] = row[column];
  }
  return projected;
}

/** The answers the approval rule needs from the database, keyed by statement. */
function respondWith({ contactStatus }) {
  const contact = {
    cid: "C-ABEL",
    name: "Abel",
    email: "abel@example.com",
    password: "hash",
    role: "member",
    status: contactStatus,
  };
  mockDb.execute.mockImplementation(async (statement) => {
    const sql = sqlOf(statement);
    if (sql.includes("FROM contacts WHERE LOWER(email)")) {
      return { rows: [project(contact, sql)] };
    }
    return { rows: [] };
  });
}

const APPROVED_CTX = {
  review: { id: 9, decision: "approved", comment: null, reviewer_name: "Reviewer" },
  submission: {
    id: 5,
    run_id: 4,
    status: "approved",
    submitter_id: "abel@example.com",
    submitter_name: "Abel",
    data: { "f-email": "abel@example.com" },
  },
  run: { id: 4, name: "Programme Incubation Cohorte 5 Run", form_id: 8, settings: {} },
  form: { id: 8, settings: {} },
  session: { cid: "USR-ADMIN" },
};

/** Every statement the rule wrote against the person's account. */
function contactWrites() {
  return mockDb.execute.mock.calls
    .filter(([statement]) => /UPDATE\s+contacts\s+SET/i.test(sqlOf(statement)))
    .map(([statement]) => sqlOf(statement));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("REVIEW_COMPLETED automation — account state", () => {
  test("an already-active account keeps its status and gets a login link", async () => {
    respondWith({ contactStatus: "active" });

    await fireEvent(PLATFORM_EVENTS.REVIEW_COMPLETED, APPROVED_CTX);

    // The decisive assertion: approval must not write "status = 'approved'"
    // over an active account (the identity/group update is the only write that
    // carries a status, and it must be skipped here).
    expect(contactWrites().some((sql) => /status\s*=\s*'approved'/i.test(sql))).toBe(false);
    expect(decideEmailKind).toHaveBeenCalledWith(
      expect.objectContaining({ accountExists: true, accountActivated: true }),
    );
    expect(sendLoginEmail).toHaveBeenCalledTimes(1);
    expect(sendInviteEmail).not.toHaveBeenCalled();
  });

  test("a person who has not activated is approved and gets a setup link", async () => {
    respondWith({ contactStatus: "approved" });

    await fireEvent(PLATFORM_EVENTS.REVIEW_COMPLETED, APPROVED_CTX);

    expect(contactWrites().some((sql) => /status\s*=\s*'approved'/i.test(sql))).toBe(true);
    expect(decideEmailKind).toHaveBeenCalledWith(
      expect.objectContaining({ accountExists: true, accountActivated: false }),
    );
    expect(sendInviteEmail).toHaveBeenCalledTimes(1);
    expect(sendLoginEmail).not.toHaveBeenCalled();
  });
});
