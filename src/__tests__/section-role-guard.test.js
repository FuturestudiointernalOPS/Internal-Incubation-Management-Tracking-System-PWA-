/**
 * @jest-environment jsdom
 *
 * Personal identities are turned away from the operating sections; staff-family
 * accounts (Lead Managers included) and unknown roles are not.
 */
import { render, screen, waitFor } from "@testing-library/react";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: mockReplace }) }));

let mockRole = null;
jest.mock("@/lib/dashboardSession", () => ({
  getDashboardSessionUser: () => (mockRole ? { role: mockRole } : null),
  subscribeDashboardSession: () => () => {},
}));

const SectionRoleGuard = require("@/components/layout/SectionRoleGuard").default;
const { isTurnedAway, PERSONAL_HOME } = require("@/components/layout/SectionRoleGuard");

beforeEach(() => mockReplace.mockClear());

test.each(["member", "participant", "founder", "investor", " Member "])("%s is turned away", async (role) => {
  mockRole = role;
  render(<SectionRoleGuard><p>operating area</p></SectionRoleGuard>);
  expect(screen.queryByText("operating area")).toBeNull();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(PERSONAL_HOME));
});

test.each(["staff", "program_manager", "super_admin", "finance", "crm", "facilitator", "team"])("%s keeps the section", (role) => {
  mockRole = role;
  render(<SectionRoleGuard><p>operating area</p></SectionRoleGuard>);
  expect(screen.getByText("operating area")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("while the role is unknown the section renders as before", () => {
  mockRole = null;
  render(<SectionRoleGuard><p>operating area</p></SectionRoleGuard>);
  expect(screen.getByText("operating area")).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("the predicate", () => {
  expect(isTurnedAway("member")).toBe(true);
  expect(isTurnedAway("staff")).toBe(false);
  expect(isTurnedAway(undefined)).toBe(false);
});
