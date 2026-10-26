/** @jest-environment jsdom */
import { render, screen, fireEvent } from "@testing-library/react";
import OrganizationProgramPortal from "@/components/ui/OrganizationProgramPortal";
import { useApi } from "@/lib/hooks/useApi";
jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key) => key, lang: "en" }) }));
jest.mock("@/lib/hooks/useApi", () => ({ useApi: jest.fn() }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let context, programmes;
beforeEach(() => {
  context = { success: true, activeOrganizationId: id, organization: { id, name: "Synthetic Alpha", code: "alpha" }, organizations: [{ id, name: "Synthetic Alpha", code: "alpha" }] };
  programmes = { success: true, organizationId: id, programs: [{ id: "program", name: "Synthetic private programme", status: "planned" }], pagination: { hasMore: false } };
  useApi.mockImplementation((url) => ({ data: url === "/api/org/context" ? context : programmes, loading: false, error: null, refresh: jest.fn() }));
});
test("the route code does not select an organisation", () => {
  render(<OrganizationProgramPortal organizationCode="forged" />);
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
  expect(screen.getByText("errors.organizationContextChanged")).toBeTruthy();
});
test("client reads bypass shared caches and bind only a freshness header", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" />);
  expect(screen.getByText("Synthetic private programme")).toBeTruthy();
  expect(useApi).toHaveBeenCalledWith(expect.stringContaining("/api/org/programs?"), expect.objectContaining({ cache: false, fetchOptions: { cache: "no-store", headers: { "X-Organization-Id": id } } }));
});
test("a response belonging to a different organisation is never rendered", () => {
  programmes.organizationId = "foreign";
  render(<OrganizationProgramPortal organizationCode="alpha" />);
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
});
test("revocation in another tab invalidates the entire current view", () => {
  render(<OrganizationProgramPortal organizationCode="alpha" />);
  context = { success: true, organization: null, organizations: [], activeOrganizationId: id };
  fireEvent(window, new StorageEvent("storage", { key: "impactos_organization_changed", newValue: "changed" }));
  expect(screen.queryByText("Synthetic private programme")).toBeNull();
  expect(screen.getByText("common.organizationPortal.noOrganizations")).toBeTruthy();
});
