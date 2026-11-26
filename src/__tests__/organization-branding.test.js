jest.mock("@/models/organizations/branding", () => ({ withOrganizationBranding: jest.fn() }));
jest.mock("@/lib/token-hashing", () => ({ hashToken: (token) => `hash-${token}` }));

import { withOrganizationBranding } from "@/models/organizations/branding";
import { updateOrganizationBranding } from "@/services/organizations/branding";

const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session = { cid: "SYNTHETIC", token: "synthetic-token" };
let reader;
const call = (overrides = {}) => updateOrganizationBranding({
  session,
  expectedOrganizationId: organizationId,
  body: { display_name: "New name", primary_color: "#123456" },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  reader = {
    snapshot: {
      organization_id: organizationId, name: "Synthetic Org", actor_role: "member",
      is_platform: false, organization_status: "active", membership_id: "membership",
      contract_active: true, module_enabled: true,
      assignments: [{ id: "role", scopeType: "organization", templateScope: "organization", viewLevel: 1 }],
      grants: [],
    },
    hasEditPermission: jest.fn(async () => true),
    getBranding: jest.fn(async () => ({ display_name: "Old name", logo_url: "https://cdn.example.test/old.svg", primary_color: "#234567" })),
    updateBranding: jest.fn(async (_org, _person, values) => ({ organization_id: organizationId,
      display_name: values.displayName, logo_url: values.logoUrl, primary_color: values.primaryColor })),
  };
  withOrganizationBranding.mockImplementation(async (_credentials, callback) => callback(reader));
});

test("requires a client session and refuses invalid or extra fields before database access", async () => {
  expect((await call({ session: null })).reason).toBe("no-session");
  expect((await call({ body: { display_name: "Name", organization_id: organizationId } })).reason).toBe("invalid-query");
  expect(withOrganizationBranding).not.toHaveBeenCalled();
});

test("requires the active organisation and its explicit branding capability", async () => {
  expect((await call({ expectedOrganizationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).reason).toBe("context-changed");
  expect(reader.hasEditPermission).not.toHaveBeenCalled();
  reader.hasEditPermission.mockResolvedValue(false);
  expect((await call()).reason).toBe("capability-missing");
  expect(reader.updateBranding).not.toHaveBeenCalled();
});

test.each([
  { logo_url: "javascript:alert(1)" },
  { logo_url: "http://example.test/logo.png" },
  { logo_url: "//example.test/logo.png" },
  { primary_color: "#ffffff" },
  { primary_color: "#12345g" },
])("rejects unsafe branding input: %j", async (field) => {
  expect((await call({ body: field })).reason).toBe("invalid-query");
  expect(reader.updateBranding).not.toHaveBeenCalled();
});

test("updates only supplied fields and preserves the existing branding values", async () => {
  const result = await call({ body: { display_name: "  New name  " } });
  expect(result).toEqual({ success: true, organizationId, branding: {
    displayName: "New name", logoUrl: "https://cdn.example.test/old.svg", primaryColor: "#234567",
  } });
  expect(reader.updateBranding).toHaveBeenCalledWith(organizationId, session.cid, {
    displayName: "New name", logoUrl: "https://cdn.example.test/old.svg", primaryColor: "#234567",
  });
});
