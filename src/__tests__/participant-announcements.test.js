/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ParticipantAnnouncementsPage from "@/app/member/(contexts)/participant/announcements/page";
const mockRefresh = jest.fn();
const mockAlert = jest.fn();
const mockData = { success: true, recipientId: "p1", announcements: [
  { id: 1, title: "Pitch session", message: "Bring your slides", is_read: 0, created_at: "2026-10-08T10:00:00Z" },
  { id: 2, title: "Funding opportunity", message: "Applications open", category: "opportunity", is_read: 1, created_at: "2026-10-07T10:00:00Z" },
] };
jest.mock("@/lib/hooks/useApi", () => ({ useApi: () => ({ data: mockData, loading: false, error: null, refresh: mockRefresh }) }));
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ alert: mockAlert }) }));
jest.mock("@/lib/i18n", () => ({ useI18n: () => ({ lang: "en", t: (key, params = {}) => {
  const data = { ...require("@/locales/en/participant.json"), ...require("@/locales/en/common.json"), ...require("@/locales/en/navigation.json") };
  let value = key.split(".").reduce((obj, name) => obj?.[name], data) || key;
  Object.entries(params).forEach(([name, val]) => { value = value.replaceAll(`{${name}}`, val); });
  return value;
} }) }));
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }); });
afterEach(cleanup);
test("lists announcements and filters them by read state", () => {
  render(<ParticipantAnnouncementsPage />);
  expect(screen.getByText("Pitch session")).toBeTruthy();
  expect(screen.getByText("Funding opportunity")).toBeTruthy();

  const filter = screen.getByRole("combobox", { name: "Read status" });
  fireEvent.change(filter, { target: { value: "read" } });
  expect(screen.getByText("Funding opportunity")).toBeTruthy();
  expect(screen.queryByText("Pitch session")).toBeNull();
});
test("the unread filter is the mirror image of the read one", () => {
  render(<ParticipantAnnouncementsPage />);
  const filter = screen.getByRole("combobox", { name: "Read status" });

  fireEvent.change(filter, { target: { value: "unread" } });
  expect(screen.getByText("Pitch session")).toBeTruthy();
  expect(screen.queryByText("Funding opportunity")).toBeNull();

  fireEvent.change(filter, { target: { value: "all" } });
  expect(screen.getByText("Pitch session")).toBeTruthy();
  expect(screen.getByText("Funding opportunity")).toBeTruthy();
});
test("marking read and unread updates the shared inbox with the notification id", async () => {
  render(<ParticipantAnnouncementsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ id: 1, action: "read" });
  fireEvent.click(screen.getAllByRole("button", { name: "Mark as unread" })[0]);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ id: 1, action: "unread" });
});
test("failed read update leaves the row unread and displays an in-app notice", async () => {
  fetch.mockResolvedValue({ ok: false, json: async () => ({ success: false }) });
  render(<ParticipantAnnouncementsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(mockAlert).toHaveBeenCalled());
  expect(screen.getByRole("button", { name: "Mark as read" })).toBeTruthy();
});
