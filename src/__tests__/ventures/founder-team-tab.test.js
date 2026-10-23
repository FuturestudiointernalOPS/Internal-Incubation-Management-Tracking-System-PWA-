/**
 * @jest-environment jsdom
 *
 * The founder's Team tab: roles are displayed, never chosen, and "Add member"
 * invites FOUNDERS only.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const mockCtx = {
  members: [{ id: 1, member_type: "founder", role: "founder", contact_name: "Chris", contact_id: "USR_1", joined_at: "2026-10-09T10:00:00Z" }],
  membersLoading: false,
  setRemoveConfirm: jest.fn(),
  setShowAddMember: jest.fn(),
  setAddMemberType: jest.fn(),
  showAddMember: false,
  inviteEmail: "",
  setInviteEmail: jest.fn(),
  inviting: false,
  handleInviteMember: jest.fn(),
  cardStyle: {},
  inputStyle: {},
  invitations: [],
  handleRevokeInvitation: jest.fn(),
  params: null,
};
jest.mock("@/components/ventures/workspace/VentureContext", () => ({ useVenture: () => mockCtx }), { virtual: true });
jest.mock("../../components/ventures/workspace/VentureContext", () => ({ useVenture: () => mockCtx }));

const { I18nProvider } = require("@/lib/i18n");
const { TeamTab } = require("@/components/ventures/workspace/tabs/MembersTabs");

const view = () => render(<I18nProvider><TeamTab /></I18nProvider>);

beforeEach(() => {
  Object.values(mockCtx).forEach((value) => value?.mockClear?.());
  mockCtx.showAddMember = false;
});

test("a member's role is shown as text: there is no role selector", () => {
  const { container } = view();
  expect(container.querySelector("select")).toBeNull();
  expect(screen.getByText("founder")).toBeTruthy();
});

test("Add member opens the invite as a FOUNDER invite", () => {
  view();
  fireEvent.click(screen.getByRole("button", { name: /Add Member/i }));
  expect(mockCtx.setAddMemberType).toHaveBeenCalledWith("founder");
  expect(mockCtx.setShowAddMember).toHaveBeenCalledWith(true);
});

test("the invite dialog asks for an email only: no member-type choice", () => {
  mockCtx.showAddMember = true;
  view();
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector("select")).toBeNull();
  expect(dialog.querySelector('input[type="email"]')).toBeTruthy();
  expect(dialog.textContent).toMatch(/founder/i);
});
