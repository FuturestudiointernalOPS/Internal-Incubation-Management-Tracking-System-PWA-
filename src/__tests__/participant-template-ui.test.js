/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", t: (key, parameters = {}) => {
  const namespaces = { ...require("@/locales/en/participant.json"), ...require("@/locales/en/common.json"), ...require("@/locales/en/time.json"), ...require("@/locales/en/navigation.json"), ...require("@/locales/en/participantMisc.json") };
  const value = key.split(".").reduce((obj, part) => obj?.[part], namespaces) || key;
  return Object.entries(parameters).reduce((text, [name, v]) => text.replaceAll(`{${name}}`, v), value);
} }) }));
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: jest.fn().mockResolvedValue(true), alert: jest.fn() }) }));
jest.mock("@/lib/PermissionProvider", () => ({ usePermissions: () => ({ can: () => false }) }));
let mockRole = "participant";
let mockInvestor = false;
jest.mock("@/lib/hooks/useSessionUser", () => ({ useSessionUser: () => ({ user: { cid: "P1", role: mockRole }, role: mockRole }) }));
const mockHome = {
  success: true, participant: { cid: "P1", name: "Amina Koné" },
  primaryProgram: { id: "program1", name: "Come UP", currentWeek: 2, durationWeeks: 12, metrics: { programCompletion: 25, attendanceRate: 50, assignmentCompletion: 20, kpiCompletion: 30 } },
  programs: [{ id: "program1" }], calendarEvents: [], announcements: [],
  actionCenter: { overdue: [], dueSoon: [], pendingSubmissions: [], upcomingSessions: [] },
};
const mockCourses = [{ course: { id: "course1", title: "Real course" }, progress: { percent: 50, completedLessons: 2, totalLessons: 4 } }];
jest.mock("@/lib/hooks/useApi", () => ({
  useApi: (url, options) => {
    const payload = url === "/api/me/relationships" ? { success: true, isInvestor: mockInvestor } : url === "/api/participant/home" ? mockHome : { success: true, courses: mockCourses };
    return { data: options.transform ? options.transform(payload) : payload, loading: false, error: null, refresh: jest.fn() };
  },
  useApiMulti: () => ({ data: {}, loading: false, error: null }),
}));
const { default: ParticipantCommandCalendar, calendarRange, placeCalendarItems } = require("@/components/ui/ParticipantCommandCalendar");
const ParticipantDashboardHome = require("@/components/dashboard/ParticipantDashboardHome").default;

beforeEach(() => { mockRole = "participant"; mockInvestor = false; jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-08T12:00:00Z")); });
afterEach(() => { cleanup(); jest.useRealTimers(); });

test("month starts from its own month even when the first day is a Sunday", () => {
  const days = calendarRange(new Date(2026, 1, 1), "month");
  expect(days).toHaveLength(42);
  expect(days[0].getMonth()).toBe(0);
  expect(days[0].getDate()).toBe(26);
  expect(days.some(day => day.getMonth() === 1 && day.getDate() === 28)).toBe(true);
});
test("overlapping sessions have separate lanes and touching intervals share one lane", () => {
  const rows = placeCalendarItems([{ id: 1, time: "09:00", end: "10:00" }, { id: 2, time: "09:30", end: "11:00" }, { id: 3, time: "11:00", end: "12:00" }]);
  expect(rows[0].lane).not.toBe(rows[1].lane);
  expect(rows[0].lanes).toBe(2);
  expect(rows[2].lanes).toBe(1);
});
test("official events remain read-only and keep their existing program route", () => {
  render(<ParticipantCommandCalendar events={[{ id: 1, date: "2026-10-08", title: "Official session", type: "session", programId: "p1" }]} />);
  fireEvent.click(screen.getByRole("button", { name: /Official session/ }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("link", { name: "Open details" }).getAttribute("href")).toBe("/participant/p1");
  expect(dialog.queryByRole("button", { name: "Delete" })).toBeNull();
});
test("local reminder validates duration, can be added, and is found by search", () => {
  render(<ParticipantCommandCalendar />);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Title"), { target: { value: "Prepare pitch" } });
  fireEvent.change(dialog.getByLabelText("End"), { target: { value: "08:00" } });
  fireEvent.click(dialog.getByRole("button", { name: "Add" }));
  expect(dialog.getByRole("alert").textContent).toBe("End time must be after start time.");
  fireEvent.change(dialog.getByLabelText("End"), { target: { value: "10:00" } });
  fireEvent.click(dialog.getByRole("button", { name: "Add" }));
  expect(screen.getByRole("button", { name: /Prepare pitch/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search"), { target: { value: "absent" } });
  expect(screen.queryByRole("button", { name: /Prepare pitch/ })).toBeNull();
  fireEvent.change(screen.getByLabelText("Search"), { target: { value: "pitch" } });
  fireEvent.click(screen.getByRole("button", { name: "Week" }));
  expect(screen.getByRole("button", { name: /Prepare pitch/ })).toBeTruthy();
});
test("dashboard keeps course links and omits the removed shortcut and ritual sections", () => {
  render(<ParticipantDashboardHome />);
  expect(screen.getByText("Welcome back, Amina")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Real course/ }).getAttribute("href")).toBe("/participant/learning/course1");
  expect(screen.queryByRole("link", { name: /Assignments/ })).toBeNull();
  expect(screen.queryByRole("heading", { name: /Shortcuts|My rituals/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Messages/ })).toBeNull();
  expect(screen.queryByText("Your weekly recap")).toBeNull();
});

 test.each([["investor", false], ["member", true]])("investor account %s does not see participant learning, progress or attention blocks", (role, investor) => {
  mockRole = role; mockInvestor = investor;
  render(<ParticipantDashboardHome />);
  expect(screen.queryByRole("link", { name: /All my courses/i })).toBeNull();
  expect(screen.queryByRole("heading", { name: /My Learning|Your Progress|Overdue|Due Soon|Pending/i })).toBeNull();
  expect(screen.getByRole("link", { name: /View all announcements/i })).toBeTruthy();
});
 test("participant keeps progress, attention and learning blocks", () => {
  render(<ParticipantDashboardHome />);
  expect(screen.getByRole("heading", { name: "Your Progress" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: /Overdue/i })).toBeTruthy();
  expect(screen.getByRole("link", { name: /All my courses/i })).toBeTruthy();
});
