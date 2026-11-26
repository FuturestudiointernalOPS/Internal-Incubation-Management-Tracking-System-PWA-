/**
 * `set_role` stores a BASELINE identity, never an intake stage.
 *
 * `applicant` used to be a writable label. The identity model resolves it to
 * `member` at sign-in, so writing it into the account created a mismatch
 * between the stored label and the rights the person actually received. The
 * write translates it now, and the audit records what was stored — an admin
 * reading the history must not be told `applicant` when the column holds
 * `member`.
 */

const mockState = {
  setUserRole: jest.fn(async () => ({})),
  getContactForAssignment: jest.fn(async () => ({ rows: [{ cid: "C1", role: "member" }] })),
  logPermissionAudit: jest.fn(async () => true),
};

// The service reads some helpers from the barrel facade and some from the
// directory index, so both specifiers resolve to the same mock here.
const mockModels = {
  getContactNameAndRole: jest.fn(async () => ({ rows: [{ name: "Target", role: "member" }] })),
  getContactForAssignment: (...args) => mockState.getContactForAssignment(...args),
  setUserRole: (...args) => mockState.setUserRole(...args),
  invalidateAuthorizationContext: jest.fn(),
  invalidateAllAuthorizationContexts: jest.fn(),
  getAuthorizationContext: jest.fn(async () => null),
  MODULE_TO_FEATURE: {},
};

jest.mock("@/models/authorization", () => mockModels);
jest.mock("@/models/authorization/index", () => mockModels);
jest.mock("@/models/authorization/accessQueries", () => ({
  logPermissionAudit: (...args) => mockState.logPermissionAudit(...args),
}));

const { applyPermissionChange } = require("@/services/authorization/permissionWrites");

const setRole = (role) =>
  applyPermissionChange({
    action: "set_role",
    userCid: "C1",
    // The handler requires the capability context the screen sends with a role
    // change; only its eligibility branch is skipped for this action.
    module: "finance",
    capability: "view",
    payload: { role },
    actor: { cid: "ADMIN-1", name: "Admin" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockState.getContactForAssignment.mockResolvedValue({
    rows: [{ cid: "C1", role: "member" }],
  });
});

test("the applicant intake label is stored as the member baseline", async () => {
  await setRole("applicant");

  expect(mockState.setUserRole).toHaveBeenCalledWith("member", "C1");
});

test("the audit records the value that was actually stored", async () => {
  mockState.getContactForAssignment.mockResolvedValue({
    rows: [{ cid: "C1", role: "applicant" }],
  });

  await setRole("applicant");

  expect(mockState.logPermissionAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "role_changed",
      previousValue: "applicant",
      newValue: "member",
      details: "Role changed to member",
    }),
  );
});

test("a real identity is written unchanged", async () => {
  await setRole("staff");

  expect(mockState.setUserRole).toHaveBeenCalledWith("staff", "C1");
  expect(mockState.logPermissionAudit).toHaveBeenCalledWith(
    expect.objectContaining({ newValue: "staff" }),
  );
});
