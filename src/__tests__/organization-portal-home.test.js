import {
  resolveOrganizationPortalHome,
  singleOrganizationCandidate,
} from "@/lib/organizationPortalHome";

test("prefers the active organisation home over the chooser", () => {
  expect(resolveOrganizationPortalHome({
    success: true,
    organization: { id: "1", code: "qaws" },
    organizations: [
      { id: "1", code: "qaws" },
      { id: "2", code: "other" },
    ],
  })).toBe("/o/qaws");
});

test("uses the only membership directly when nothing is active yet", () => {
  const context = {
    success: true,
    organization: null,
    organizations: [{ id: "1", code: "qaws", name: "QAWS" }],
  };
  expect(resolveOrganizationPortalHome(context)).toBe("/o/qaws");
  expect(singleOrganizationCandidate(context)).toEqual(context.organizations[0]);
});

test("keeps the chooser only when several workspaces exist without an active one", () => {
  expect(resolveOrganizationPortalHome({
    success: true,
    organization: null,
    organizations: [
      { id: "1", code: "a" },
      { id: "2", code: "b" },
    ],
  })).toBe("/o/select");
});

test("returns null when no client organisation is accessible", () => {
  expect(resolveOrganizationPortalHome({ success: true, organization: null, organizations: [] })).toBeNull();
  expect(resolveOrganizationPortalHome({ success: false })).toBeNull();
});
