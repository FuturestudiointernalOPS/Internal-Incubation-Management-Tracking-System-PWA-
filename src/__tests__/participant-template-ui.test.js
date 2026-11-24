/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within, cleanup } from "@testing-library/react";

jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", t: (key, parameters = {}) => {
  const namespaces = { ...require("@/locales/en/participant.json"), ...require("@/locales/en/common.json"), ...require("@/locales/en/time.json"), ...require("@/locales/en/navigation.json"), ...require("@/locales/en/participantMisc.json") };
  const value = key.split(".").reduce((obj, part) => obj?.[part], namespaces) || key;
  return Object.entries(parameters).reduce((text, [name, v]) => text.replaceAll(`{${name}}`, v), value);
} }) }));
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: jest.fn().mockResolvedValue(true), alert: jest.fn() }) }));
const { default: ParticipantCommandCalendar, calendarRange, placeCalendarItems } = require("@/components/ui/ParticipantCommandCalendar");

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-08T12:00:00Z")); });
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
  expect(dialog.getByRole("link", { name: "Open details" }).getAttribute("href")).toBe("/member/participant/p1");
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
