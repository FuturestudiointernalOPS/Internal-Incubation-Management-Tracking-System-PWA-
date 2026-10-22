/**
 * @jest-environment jsdom
 *
 * "Collaborators": the dashboard card opens the Project page's list of people,
 * and a person with no email gets an "Add email" button.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockPrompt = jest.fn();
const mockAlert = jest.fn(async () => {});
jest.mock("@/components/ui/DialogProvider", () => ({
  useDialogs: () => ({ prompt: mockPrompt, alert: mockAlert, confirm: jest.fn(async () => true) }),
}));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const CollaboratorsModal = require("@/components/ventures/venture-dashboard/CollaboratorsModal").default;
const en = require("@/locales/en/vadmin.json");

const people = [
  { name: "Awa", roles: ["owner"], email: "awa@example.org" },
  { name: "David", roles: ["supporting"], email: null, reason: "noAddress" },
  { name: "Kofi", roles: ["owner"], email: null, reason: "noAddress" },
];

let posts;
beforeEach(() => {
  clearResponseCache();
  mockPrompt.mockReset();
  mockAlert.mockClear();
  posts = [];
  global.fetch = jest.fn((url, options = {}) => {
    if (options.method === "POST") {
      posts.push({ url: String(url), body: JSON.parse(options.body) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, people, summary: {} }) });
  });
});

const open = () => render(<I18nProvider><CollaboratorsModal ventureId="VNT-1" isOpen onClose={() => {}} /></I18nProvider>);

test("the card is named Collaborators", () => {
  expect(en.vadmin.dashboard.coachingAndAdvisors).toBe("Collaborators");
});

test("lists the Project page's people: addresses shown, the others offer Add email", async () => {
  open();
  expect(await screen.findByText("awa@example.org")).toBeTruthy();
  expect(screen.getByText("David")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Add email/ })).toHaveLength(2); // David and Kofi, not Awa
  expect(global.fetch.mock.calls[0][0]).toBe("/api/ventures/VNT-1/people");
});

test("adding an email posts it against that name only", async () => {
  mockPrompt.mockResolvedValue("kofi@example.org");
  open();
  await screen.findByText("Kofi");
  fireEvent.click(screen.getAllByRole("button", { name: /Add email/ })[1]);
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].url).toBe("/api/ventures/VNT-1/reminders");
  expect(posts[0].body).toEqual({ action: "set_assignee_email", display_name: "Kofi", email: "kofi@example.org" });
});

test("cancelling the prompt sends nothing", async () => {
  mockPrompt.mockResolvedValue(null);
  open();
  await screen.findByText("David");
  fireEvent.click(screen.getAllByRole("button", { name: /Add email/ })[0]);
  await waitFor(() => expect(mockPrompt).toHaveBeenCalled());
  expect(posts).toEqual([]);
});

test("a refusal from the server is announced, not swallowed", async () => {
  mockPrompt.mockResolvedValue("x@example.org");
  global.fetch = jest.fn((url, options = {}) =>
    options.method === "POST"
      ? Promise.resolve({ ok: false, json: () => Promise.resolve({ success: false, error: "errors.insufficientPermissions" }) })
      : Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, people, summary: {} }) }));
  open();
  await screen.findByText("David");
  fireEvent.click(screen.getAllByRole("button", { name: /Add email/ })[0]);
  await waitFor(() => expect(mockAlert).toHaveBeenCalled());
});
