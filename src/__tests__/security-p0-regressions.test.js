/**
 * SECURITY — regression tests for the P0 fixes of the application audit.
 *
 * Each test pins a boundary that used to be open:
 *   1. POST /api/contacts must not let an unauthenticated (or non-privileged)
 *      caller choose the role or the status — login derives the session role
 *      from contacts.role, so this was an anonymous super_admin creation path.
 *   2. GET /api/families must never return the shared group credentials.
 *   3. The invite flow must not hand out a password-setup token to the inviter,
 *      and must not mint one for an already-activated account.
 *   4. Public / investor registration must not overwrite an existing account,
 *      and must store passwords hashed.
 */

const fs = require("fs");
const path = require("path");

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn().mockResolvedValue(null),
  getSession: jest.fn(),
  hasProgramManagementAccess: jest.fn().mockReturnValue(true),
  assertNoParticipantFacilitatorConflict: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/authorization", () => ({
  requireAuthorization: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/authorization/membership", () => ({
  normalizeGroupName: (value) => String(value || "").trim().toUpperCase(),
  INTERNAL_GROUP: "FUTURE STUDIO",
}));

jest.mock("@/lib/invitations", () => ({
  attachInvitationStatus: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/email", () => ({
  sendInviteEmail: jest.fn().mockResolvedValue({ success: true }),
  sendLoginEmail: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock("@/models/contacts", () => ({
  upsertContact: jest.fn().mockResolvedValue({ rows: [] }),
  createAccessRequestNotification: jest.fn().mockResolvedValue(true),
  createPasswordSetupToken: jest.fn().mockResolvedValue(true),
  markContactInvited: jest.fn().mockResolvedValue(true),
  assignContactToProgram: jest.fn().mockResolvedValue(true),
  createParticipantProgramAudit: jest.fn().mockResolvedValue(true),
  findContactCidByPhone: jest.fn().mockResolvedValue({ rows: [] }),
  createDuplicatePhoneFlag: jest.fn().mockResolvedValue(true),
  updateContactFields: jest.fn().mockResolvedValue({ rows: [] }),
  deleteContactPrograms: jest.fn().mockResolvedValue(true),
  getProgramById: jest.fn().mockResolvedValue({ rows: [] }),
  removeContactProgramsExcept: jest.fn().mockResolvedValue(true),
  clearContactPrograms: jest.fn().mockResolvedValue(true),
  addContactProgramMembership: jest.fn().mockResolvedValue(true),
  recordParticipantProgramAudit: jest.fn().mockResolvedValue(true),
  ensureContactProgramMembership: jest.fn().mockResolvedValue(true),
  getContactIdentityByCid: jest.fn().mockResolvedValue({ rows: [] }),
  markAdminNotificationsRead: jest.fn().mockResolvedValue(true),
  getContactByCid: jest.fn().mockResolvedValue({ rows: [] }),
  getArchivedContacts: jest.fn().mockResolvedValue({ rows: [] }),
  getContactsForSuperAdmin: jest.fn().mockResolvedValue({ rows: [] }),
  getContactsForStaff: jest.fn().mockResolvedValue({ rows: [] }),
  getParticipantProgramCids: jest.fn().mockResolvedValue({ rows: [] }),
  getContactRoleAssignmentCids: jest.fn().mockResolvedValue({ rows: [] }),
  softDeleteContact: jest.fn().mockResolvedValue(true),
  // families route
  getFamilyByRegistrationId: jest.fn(),
  getAllFamilies: jest.fn().mockResolvedValue({ rows: [] }),
}));

const { getSession, requireAuth } = require("@/lib/auth");
const { requireAuthorization } = require("@/lib/authorization");
const { upsertContact, getFamilyByRegistrationId } = require("@/models/contacts");

const { POST: postContact } = require("@/app/api/contacts/route");
const { GET: getFamilies } = require("@/app/api/families/route");

const jsonReq = (body) => ({ json: async () => body });
const ROOT = path.join(__dirname, "..", "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

beforeEach(() => {
  jest.clearAllMocks();
  requireAuth.mockResolvedValue(null);
  requireAuthorization.mockResolvedValue(null);
  upsertContact.mockResolvedValue({ rows: [] });
});

describe("POST /api/contacts — role and status are server-controlled", () => {
  test("an anonymous submission cannot grant an elevated role (no super_admin)", async () => {
    getSession.mockResolvedValue(null);

    const res = await postContact(
      jsonReq({
        name: "Attacker",
        email: "attacker@example.io",
        role: "super_admin",
        status: "active",
      }),
    );
    await res.json();

    expect(upsertContact).toHaveBeenCalledTimes(1);
    const written = upsertContact.mock.calls[0][0];
    expect(written.role).toBe("unassigned");
    // A public registration is always gated behind approval.
    expect(written.status).toBe("pending");
  });

  test("an anonymous submission may still register as a participant", async () => {
    getSession.mockResolvedValue(null);

    await postContact(
      jsonReq({ name: "Applicant", email: "a@example.io", role: "participant" }),
    );

    const written = upsertContact.mock.calls[0][0];
    expect(written.role).toBe("participant");
    expect(written.status).toBe("pending");
  });

  test("an authenticated non-privileged caller cannot set a privileged role", async () => {
    getSession.mockResolvedValue({ cid: "C-1", role: "staff" });
    requireAuthorization.mockImplementation(async (_feature, capability) => {
      if (capability === "assign_capabilities") {
        return { status: 403 };
      }
      return null;
    });

    await postContact(
      jsonReq({ name: "Insider", email: "insider@example.io", role: "super_admin" }),
    );

    expect(upsertContact.mock.calls[0][0].role).toBe("unassigned");
  });

  test("a role-assignment holder may still set the requested role", async () => {
    getSession.mockResolvedValue({ cid: "SA", role: "super_admin" });
    requireAuthorization.mockResolvedValue(null);

    await postContact(
      jsonReq({
        name: "New Staff",
        email: "staff@example.io",
        role: "staff",
        status: "active",
      }),
    );

    const written = upsertContact.mock.calls[0][0];
    expect(written.role).toBe("staff");
    expect(written.status).toBe("active");
  });
});

describe("GET /api/families — shared credentials never leave the API", () => {
  test("the public registration-id lookup strips the shared passwords", async () => {
    getFamilyByRegistrationId.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: "Group One",
          registration_id: "GRP-ABC123",
          shared_password_edit: "let-me-in",
          shared_password_read: "read-only",
        },
      ],
    });

    const res = await getFamilies({
      url: "https://app.example/api/families?registration_id=GRP-ABC123",
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.families).toHaveLength(1);
    expect(data.families[0].name).toBe("Group One");
    expect(data.families[0]).not.toHaveProperty("shared_password_edit");
    expect(data.families[0]).not.toHaveProperty("shared_password_read");
  });
});

describe("static guarantees for the remaining P0 fixes", () => {
  test("the invite route never returns the setup token in its response", () => {
    const src = read("src/app/api/auth/invite/route.js");
    // No response object may carry the raw token.
    expect(src).not.toMatch(/\n\s+token,\n/);
    // A token is minted only for a not-yet-activated account.
    expect(src).toMatch(/if \(!accountActivated\) \{/);
  });

  test("public registration never rewrites an existing account's credentials", () => {
    const src = read("src/app/api/public/register/route.js");
    expect(src).not.toMatch(/updateContactForRegistration/);
    expect(src).toMatch(/existingContact\.rows\.length === 0/);
  });

  test("investor registration hashes the password and never mutates an existing role", () => {
    const src = read("src/app/api/investor/register/route.js");
    expect(src).toMatch(/hashPassword\(/);
    expect(src).not.toMatch(/setContactRoleToInvestor/);
  });
});
