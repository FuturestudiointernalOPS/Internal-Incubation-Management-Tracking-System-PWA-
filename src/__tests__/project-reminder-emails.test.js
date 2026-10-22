/**
 * @jest-environment jsdom
 *
 * PROJECTS — SENT EMAILS: the dedicated reminder-email screen.
 *
 * The section exists so a manager can read what was actually mailed without
 * opening every work item. Its contract is narrow and worth pinning: it reads
 * the Venture's reminder log, shows the recipient and the outcome, and keeps a
 * failed attempt visible instead of presenting every row as a success.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const ProjectReminderEmailsView =
  require("@/components/ventures/projects/ProjectReminderEmailsView").default;

const HISTORY = [
  {
    id: 2,
    work_item_kind: "activity",
    work_item_ref: "MS-01",
    work_item_title: "Validate demand",
    rule_id: null,
    trigger: "manual",
    recipient_name: "Amina",
    recipient_email: "amina@example.com",
    status: "sent",
    subject: "A word before Friday",
    body: "Please bring the interview notes.",
    attachment_name: "plan.pdf",
    sent_at: "2026-10-21T09:00:00.000Z",
    created_at: "2026-10-21T09:00:00.000Z",
    mode: "manual",
  },
  {
    id: 1,
    work_item_kind: "activity",
    work_item_ref: "MS-02",
    work_item_title: "Close first pilot",
    rule_id: 3,
    trigger: "finish",
    recipient_name: "David",
    recipient_email: "david@example.com",
    status: "failed",
    subject: null,
    body: null,
    attachment_name: null,
    error: "the transport refused the message",
    sent_at: null,
    created_at: "2026-10-20T08:00:00.000Z",
    mode: "automatic",
  },
];

beforeEach(() => {
  clearResponseCache();
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, history: HISTORY }),
    }),
  );
});

const renderView = () =>
  render(
    <I18nProvider>
      <ProjectReminderEmailsView ventureId="VNT-1" backHref="/staff/ventures/VNT-1?tab=projects" />
    </I18nProvider>,
  );

test("it reads the Venture's reminder log and lists the sent emails", async () => {
  renderView();

  expect(await screen.findByText("Validate demand")).toBeTruthy();
  expect(global.fetch).toHaveBeenCalledWith("/api/ventures/VNT-1/reminders", undefined);
  expect(screen.getByText("amina@example.com")).toBeTruthy();
  expect(screen.getByText("A word before Friday")).toBeTruthy();
  expect(screen.getByText("plan.pdf")).toBeTruthy();
});

test("a failed attempt stays visible, with its reason", async () => {
  renderView();

  expect(await screen.findByText("Close first pilot")).toBeTruthy();
  fireEvent.click(screen.getByText("Close first pilot"));

  expect(await screen.findByText("the transport refused the message")).toBeTruthy();
});

test("the back link returns to the projects view", async () => {
  renderView();

  const back = screen.getByRole("link", { name: /back to projects/i });
  expect(back.getAttribute("href")).toBe("/staff/ventures/VNT-1?tab=projects");
});
