import { evaluateLmsReadAccess } from "@/services/organizations/programAccess";

const base = {
  organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  actor_role: "member",
  organization_status: "active",
  is_platform: false,
  membership_id: "membership-a",
  contract_active: true,
  lms_module_enabled: true,
  lms_assignments: [{
    scopeType: "organization",
    scopeId: null,
    templateScope: "organization",
    capabilities: { "learning.read": 1 },
  }],
  lms_grants: [],
};

describe("client LMS read authorization", () => {
  test.each([
    [null, "no-session"],
    [{ ...base, organization_id: null }, "no-organization"],
    [{ ...base, is_platform: true }, "platform-not-client"],
    [{ ...base, organization_status: "suspended" }, "organization-inactive"],
    [{ ...base, membership_id: null }, "no-membership"],
    [{ ...base, contract_active: false }, "contract-inactive"],
    [{ ...base, lms_module_enabled: false }, "module-disabled"],
    [{ ...base, actor_role: "staff" }, "supervision-required"],
    [{ ...base, lms_assignments: [] }, "capability-missing"],
    [{ ...base, lms_assignments: [{
      ...base.lms_assignments[0],
      scopeType: "program",
      templateScope: "program",
    }] }, "capability-missing"],
  ])("fails closed for missing or invalid access prerequisites: %s", (snapshot, reason) => {
    expect(evaluateLmsReadAccess(snapshot)).toEqual({ allowed: false, reason });
  });

  test("a learner receives only their own learning surface", () => {
    expect(evaluateLmsReadAccess(base)).toEqual({
      allowed: true,
      reason: "allowed",
      scope: {
        organizationId: base.organization_id,
        catalog: false,
        learning: true,
      },
    });
  });

  test("a content manager receives only the organization catalogue", () => {
    const snapshot = {
      ...base,
      lms_assignments: [{
        ...base.lms_assignments[0],
        capabilities: { "catalog.read": 1 },
      }],
    };
    expect(evaluateLmsReadAccess(snapshot).scope).toEqual({
      organizationId: base.organization_id,
      catalog: true,
      learning: false,
    });
  });

  test("an explicit membership deny removes only the denied capability", () => {
    const snapshot = {
      ...base,
      lms_assignments: [{
        ...base.lms_assignments[0],
        capabilities: { "catalog.read": 1, "learning.read": 1 },
      }],
      lms_grants: [{
        subjectType: "membership",
        subjectId: base.membership_id,
        capability: "catalog.read",
        effect: "deny",
      }],
    };
    expect(evaluateLmsReadAccess(snapshot).scope).toEqual({
      organizationId: base.organization_id,
      catalog: false,
      learning: true,
    });
  });

  test("an allow cannot create a capability absent from the role template", () => {
    expect(evaluateLmsReadAccess({
      ...base,
      lms_assignments: [],
      lms_grants: [{
        subjectType: "membership",
        subjectId: base.membership_id,
        capability: "catalog.read",
        effect: "allow",
      }],
    })).toEqual({ allowed: false, reason: "capability-missing" });
  });
});
