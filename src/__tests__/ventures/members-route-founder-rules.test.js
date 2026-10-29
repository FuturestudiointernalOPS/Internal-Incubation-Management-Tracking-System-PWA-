/** Server rules behind the founder's Team tab: founders add founders only, and never change roles. */
const mockStaff = jest.fn();
const executed = [];

jest.mock("@/lib/db", () => ({ __esModule: true, default: { execute: jest.fn(async () => ({ rows: [] })) }, initDb: jest.fn(async () => true) }));
jest.mock("@/server/auth/guards", () => ({ requireAuth: jest.fn(async () => null) }));
jest.mock("@/lib/ventureScopedAccess", () => ({ requireVentureScopedAccess: jest.fn(async () => ({})) }));
jest.mock("@/server/auth/session", () => ({ getSession: jest.fn(async () => ({ cid: "USR_F", role: "member", name: "Founder" })) }));
jest.mock("@/lib/ventureAuth", () => ({
  roleIsPrivileged: (role) => role === "super_admin",
  isStaffActorForVenture: (...args) => mockStaff(...args),
  requireOperationalVentureAccess: jest.fn(async () => ({ ok: true })),
}));
jest.mock("@/models/ventureMemberInvitations", () => ({ createVentureMemberInvitation: jest.fn(async (args) => { executed.push(args); return { id: 1, email: args.email }; }) }));
jest.mock("@/models/ventureWorkspace", () => ({
  getVentureByCode: jest.fn(async () => ({ rows: [] })),
  listVentureMembersWithContacts: jest.fn(async () => ({ rows: [] })),
  findVentureMemberByEmail: jest.fn(async () => ({ rows: [] })),
  getVentureDisplayNameByCode: jest.fn(async () => ({ rows: [{ venture_name: "AgroTech" }] })),
  getVentureMemberById: jest.fn(async () => ({ rows: [] })),
  getVentureMemberContactId: jest.fn(async () => ({ rows: [{ contact_id: "USR_X" }] })),
  archiveVentureMember: jest.fn(async () => ({})),
  updateVentureMemberFields: jest.fn(async () => ({})),
}));
// The caller IS a founder of the Venture (so the founder-row gate passes): what is
// under test is what a founder may do once inside.
jest.mock("@/models/ventureMemberAccess", () => ({
  resolveVentureTableId: jest.fn(async () => "uuid-1"),
  getVentureFounderCount: jest.fn(async () => 2),
  checkVentureMemberMutateAccess: jest.fn(async () => true),
}));
jest.mock("@/services/ventures/memberRoster", () => ({
  deliverVentureMemberInvitation: jest.fn(async () => ({ emailSent: true })),
  afterVentureMemberRemoved: jest.fn(async () => ({})),
  afterVentureMemberUpdated: jest.fn(async () => ({})),
}));

const route = () => require("@/app/api/ventures/[id]/members/route");
const call = (handler, body) => handler(new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "VNT-1" }) });

beforeEach(() => { executed.length = 0; mockStaff.mockReset(); mockStaff.mockResolvedValue(false); });

test("a founder trying to invite a team member is refused", async () => {
  jest.resetModules();
  const response = await call(route().POST, { email: "a@b.org", member_type: "team_member" });
  expect(response.status).toBe(403);
  expect((await response.json()).error).toBe("errors.founderInviteOnly");
});

test("a founder trying to change a role is refused", async () => {
  jest.resetModules();
  const response = await call(route().PATCH, { member_id: 5, role: "admin" });
  expect(response.status).toBe(403);
  expect((await response.json()).error).toBe("errors.memberRoleStaffOnly");
});

test("staff may still set roles (the refusal is for non-staff only)", async () => {
  jest.resetModules();
  mockStaff.mockResolvedValue(true);
  const response = await call(route().PATCH, { member_id: 5, role: "admin" });
  expect(response.status).not.toBe(403);
});
