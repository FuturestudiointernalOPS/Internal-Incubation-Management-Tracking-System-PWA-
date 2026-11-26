import { evaluateVentureReadAccess } from "@/services/organizations/programAccess";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const base = {
  organization_id: organizationId,
  actor_role: "member",
  organization_status: "active",
  is_platform: false,
  membership_id: "membership-a",
  contract_active: true,
  venture_module_enabled: true,
  venture_assignments: [{
    scopeType: "organization",
    scopeId: null,
    templateScope: "organization",
    capabilities: { "assigned.read": 1 },
  }],
  venture_grants: [],
};

describe("client Venture read authorization", () => {
  test.each([
    [null, "no-session"],
    [{ ...base, organization_id: null }, "no-organization"],
    [{ ...base, is_platform: true }, "platform-not-client"],
    [{ ...base, organization_status: "suspended" }, "organization-inactive"],
    [{ ...base, membership_id: null }, "no-membership"],
    [{ ...base, contract_active: false }, "contract-inactive"],
    [{ ...base, venture_module_enabled: false }, "module-disabled"],
    [{ ...base, actor_role: "staff" }, "supervision-required"],
    [{ ...base, venture_assignments: [] }, "capability-missing"],
    [{ ...base, venture_assignments: [{
      ...base.venture_assignments[0],
      scopeType: "program",
      templateScope: "program",
    }] }, "capability-missing"],
  ])("fails closed for missing or invalid access prerequisites: %s", (snapshot, reason) => {
    expect(evaluateVentureReadAccess(snapshot)).toEqual({ allowed: false, reason });
  });

  test("an explicit deny overrides an assigned read capability", () => {
    expect(evaluateVentureReadAccess({
      ...base,
      venture_grants: [{
        subjectType: "membership",
        subjectId: base.membership_id,
        capability: "assigned.read",
        effect: "deny",
      }],
    })).toEqual({ allowed: false, reason: "capability-missing" });
  });

  test("a valid member can read assigned ventures only in the current organisation", () => {
    expect(evaluateVentureReadAccess(base)).toEqual({
      allowed: true,
      reason: "allowed",
      scope: { organizationId },
    });
  });
});
