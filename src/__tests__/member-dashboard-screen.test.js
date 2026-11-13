/** @jest-environment jsdom */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    t: (key, parameters = {}) => {
      const namespaces = {
        ...require("@/locales/en/member.json"),
        ...require("@/locales/en/participant.json"),
        ...require("@/locales/en/common.json"),
        ...require("@/locales/en/time.json"),
        ...require("@/locales/en/navigation.json"),
        ...require("@/locales/en/participantMisc.json"),
      };
      const value = key.split(".").reduce((obj, part) => obj?.[part], namespaces) || key;
      return Object.entries(parameters).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement),
        value,
      );
    },
  }),
}));

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/dashboard",
}));

let mockRole = "member";
jest.mock("@/lib/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ user: { cid: "C1", role: mockRole }, role: mockRole, cid: "C1" }),
}));

jest.mock("@/components/ui/ParticipantCommandCalendar", () => ({
  __esModule: true,
  default: () => <div data-testid="calendar" />,
}));
jest.mock("@/components/shared/create/CreateActions", () => ({
  __esModule: true,
  default: () => null,
}));

let mockEnvelope = null;
jest.mock("@/lib/hooks/useApi", () => ({
  useApi: (_url, options) => ({
    data: options?.transform ? options.transform(mockEnvelope) : mockEnvelope,
    loading: false,
    error: mockEnvelope ? null : true,
    refresh: jest.fn(),
  }),
  useApiMulti: () => ({ data: {}, loading: false, error: null }),
}));

const { default: DashboardScreen } = require("@/spaces/member/core/DashboardScreen");

const baseEnvelope = () => ({
  success: true,
  identity: { cid: "C1", name: "Amina Koné", email: "amina@example.com", role: "member" },
  profiles: {
    isProgramParticipant: false,
    isFacilitator: false,
    isVentureMember: false,
    isFounder: false,
    isLearner: false,
    isInvestor: false,
  },
  announcements: [],
  agenda: [],
  programs: null,
  facilitator: null,
  ventures: null,
  learning: null,
  investor: null,
});

beforeEach(() => {
  mockRole = "member";
  mockEnvelope = baseEnvelope();
  mockReplace.mockClear();
});
afterEach(cleanup);

test("a member with no relationship gets an honest empty state, not an empty program dashboard", () => {
  render(<DashboardScreen />);

  expect(screen.getByText("Nothing assigned yet")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "My program" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "My ventures" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "My learning" })).toBeNull();
});

test("the sections rendered are exactly the blocks the server sent", () => {
  mockEnvelope = {
    ...baseEnvelope(),
    profiles: { ...baseEnvelope().profiles, isProgramParticipant: true, isVentureMember: true, isFounder: true },
    programs: {
      seats: [{ id: "P1", name: "Come UP", status: "active", completed: false, readOnly: false }],
      primary: { id: "P1", name: "Come UP", status: "Active", currentWeek: 2, durationWeeks: 12 },
      progress: {
        overall: { programCompletion: 60, attendanceRate: 75, kpiCompletion: 80 },
        totals: { submissions: 4, approved: 4, sessions: 4, attended: 3, deliverables: 5, completedDeliverables: 3 },
      },
      actionCenter: { overdue: [], dueSoon: [], pendingSubmissions: [], upcomingSessions: [] },
    },
    ventures: {
      isFounder: true,
      items: [{ id: "V1", name: "Acme", status: "active", memberType: "founder", isOwner: true }],
    },
  };

  render(<DashboardScreen />);

  expect(screen.getByRole("heading", { name: "My program" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "My ventures" })).toBeTruthy();
  // Nothing was sent for learning or the investor space, so nothing is drawn.
  expect(screen.queryByRole("heading", { name: "My learning" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Investor space" })).toBeNull();
  expect(screen.queryByText("Nothing assigned yet")).toBeNull();
});

test("a staff identity reaching this address is sent to its own space", () => {
  mockRole = "staff";

  render(<DashboardScreen />);

  expect(mockReplace).toHaveBeenCalledWith("/staff");
});
