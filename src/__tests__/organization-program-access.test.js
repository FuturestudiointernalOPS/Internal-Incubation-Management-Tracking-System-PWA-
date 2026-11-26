import { evaluateProgramReadAccess } from "@/services/organizations/programAccess";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const membershipId = "membership-a";
const programId = "11111111-1111-4111-8111-111111111111";
const assignment = (overrides = {}) => ({ id: "assignment-a", scopeType: "program",
  templateScope: "program", scopeId: programId, viewLevel: 1, ...overrides });
const snapshot = (overrides = {}) => ({ organization_id: organizationId,
  actor_role: "member", membership_id: membershipId, is_platform: false, organization_status: "active",
  contract_active: true, module_enabled: true, assignments: [assignment()], grants: [], ...overrides });
const grant = (overrides = {}) => ({ subjectType: "membership", subjectId: membershipId,
  effect: "deny", scopeType: "program", scopeId: programId, accessLevel: 1, ...overrides });

describe("client Programme read authorization", () => {
  test.each([
    [null, "no-session"],
    [snapshot({ organization_id: null }), "no-organization"],
    [snapshot({ is_platform: true }), "platform-not-client"],
    [snapshot({ is_platform: null }), "platform-not-client"],
    [snapshot({ membership_id: null }), "no-membership"],
    [snapshot({ contract_active: false }), "contract-inactive"],
    [snapshot({ module_enabled: false }), "module-disabled"],
    [snapshot({ assignments: [] }), "capability-missing"],
    [snapshot({ assignments: [assignment({ viewLevel: 0 })] }), "capability-missing"],
    [snapshot({ assignments: [assignment({ viewLevel: "1" })] }), "capability-missing"],
    [snapshot({ assignments: [assignment({ scopeType: "organization", scopeId: null })] }), "capability-missing"],
  ])("denies invalid prerequisites (%s)", (input, reason) => {
    expect(evaluateProgramReadAccess(input)).toEqual({ allowed: false, reason });
  });

  test.each(["draft", "suspended", "archived", "closed"])("denies %s organisations, including reads", (status) => {
    expect(evaluateProgramReadAccess(snapshot({ organization_status: status })).allowed).toBe(false);
  });

  test("global Super Admin status cannot bypass membership", () => {
    expect(evaluateProgramReadAccess(snapshot({ membership_id: null, role: "super_admin" })))
      .toEqual({ allowed: false, reason: "no-membership" });
  });

  test("a programme manager receives only assigned programmes", () => {
    expect(evaluateProgramReadAccess(snapshot()).scope).toEqual({
      organizationId, allPrograms: false, programIds: [programId], deniedProgramIds: [],
    });
  });

  test("an organisation-scoped template can read its organisation's directory", () => {
    const result = evaluateProgramReadAccess(snapshot({ assignments: [assignment({
      scopeType: "organization", templateScope: "organization", scopeId: null,
    })] }));
    expect(result.scope).toMatchObject({ organizationId, allPrograms: true, programIds: [] });
  });

  test("explicit allow cannot expand an assigned programme to all programmes", () => {
    const result = evaluateProgramReadAccess(snapshot({ grants: [grant({
      effect: "allow", scopeType: "organization", scopeId: null, accessLevel: 99,
    })] }));
    expect(result.scope.allPrograms).toBe(false);
    expect(result.scope.programIds).toEqual([programId]);
  });

  test("an allow without a role ceiling grants nothing", () => {
    expect(evaluateProgramReadAccess(snapshot({ assignments: [], grants: [grant({ effect: "allow" })] })).allowed).toBe(false);
  });

  test("a member deny wins over the role base and an explicit allow", () => {
    const result = evaluateProgramReadAccess(snapshot({ grants: [grant({ effect: "allow" }), grant()] }));
    expect(result.scope.deniedProgramIds).toEqual([programId]);
  });

  test("an organisation-wide deny refuses the whole directory", () => {
    expect(evaluateProgramReadAccess(snapshot({ grants: [grant({ scopeType: "organization", scopeId: null })] })))
      .toEqual({ allowed: false, reason: "explicit-deny" });
  });

  test("a deny from another active role still wins over a viewing role", () => {
    const result = evaluateProgramReadAccess(snapshot({ grants: [grant({
      subjectType: "role_assignment", subjectId: "other-active-role", scopeType: "organization", scopeId: null,
    })] }));
    expect(result).toEqual({ allowed: false, reason: "explicit-deny" });
  });

  test("a different member's grant is ignored", () => {
    expect(evaluateProgramReadAccess(snapshot({ grants: [grant({ subjectId: "member-b", scopeType: "organization" })] })).allowed).toBe(true);
  });

  test("same person in client B gets a new scope, without merging A", () => {
    const b = snapshot({ organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      assignments: [assignment({ scopeId: "22222222-2222-4222-8222-222222222222" })] });
    const aScope = evaluateProgramReadAccess(snapshot()).scope;
    const bScope = evaluateProgramReadAccess(b).scope;
    expect(bScope.organizationId).not.toBe(aScope.organizationId);
    expect(bScope.programIds).not.toContain(programId);
  });
});

test("fresh internal identities require supervision even with a client membership", () => {
  expect(evaluateProgramReadAccess(snapshot({ actor_role: "staff" })).reason).toBe("supervision-required");
  expect(evaluateProgramReadAccess(snapshot({ actor_role: undefined })).allowed).toBe(false);
});
