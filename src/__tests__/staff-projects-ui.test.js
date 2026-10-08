/**
 * @jest-environment jsdom
 *
 * STAFF — MY PROJECTS: the data is connected.
 * What is read, what an invitation answer sends, and that accepting one brings
 * the project into the list.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }), __push: push };
});
jest.mock("@/lib/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ user: { cid: "C-LEA", role: "staff" }, cid: "C-LEA", role: "staff" }),
}));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const ProjectsView = require("@/components/staff/ProjectsView").default;
const { __push: push } = require("next/navigation");

let calls;
let projects;
let invitations;

function installFetch() {
  calls = [];
  global.fetch = jest.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    const reply = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (String(url).startsWith("/api/projects/invitations/respond")) {
      return reply({ success: true });
    }
    if (String(url).startsWith("/api/projects/invitations")) return reply({ success: true, invitations });
    if (String(url).startsWith("/api/projects")) return reply({ success: true, projects });
    return reply({ success: true });
  });
}

const alpha = {
  id: 4,
  name: "ImpactOS",
  status: "Active",
  meta: { description: "Plateforme de pilotage" },
  members: [{ user_cid: "C-LEA", role: "lead" }, { user_cid: "C-X", role: "member" }],
  task_summary: { total: 4, completed: 1 },
  program_name: "Come Up",
  start_date: "2026-08-18",
  end_date: null,
};

beforeEach(() => {
  clearResponseCache();
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockClear();
  projects = [alpha];
  invitations = [{ id: 9, project_name: "Plateforme Mentors" }];
  installFetch();
});

const renderView = () => render(<I18nProvider><ProjectsView /></I18nProvider>);

test("it reads the person's projects and pending invitations", async () => {
  renderView();
  expect(await screen.findByText("ImpactOS")).toBeTruthy();
  expect(calls.some((call) => call.url === "/api/projects?user_cid=C-LEA")).toBe(true);
  expect(calls.some((call) => call.url === "/api/projects/invitations?invitee_id=C-LEA&status=pending")).toBe(true);
  expect(screen.getByText("Plateforme Mentors")).toBeTruthy();
  expect(screen.getByText("Plateforme de pilotage")).toBeTruthy();
});

test("the counters are computed from the projects", async () => {
  renderView();
  await screen.findByText("ImpactOS");
  // 1 project, 1 as lead, 1 invitation, 4 linked tasks
  const values = [...document.querySelectorAll(".stf-kpi .big")].map((node) => node.textContent);
  expect(values).toEqual(["1", "1", "1", "4"]);
});

test("a project opens its detail page", async () => {
  renderView();
  fireEvent.click(await screen.findByText("ImpactOS"));
  expect(push).toHaveBeenCalledWith("/staff/projects/4");
});

test("accepting an invitation answers it, then re-reads the projects", async () => {
  renderView();
  await screen.findByText("Plateforme Mentors");
  projects = [alpha, { ...alpha, id: 5, name: "Plateforme Mentors", members: [{ user_cid: "C-LEA", role: "member" }] }];
  invitations = [];
  fireEvent.click(screen.getByRole("button", { name: /Accepter|Accept/ }));
  await waitFor(() => expect(calls.find((call) => call.url === "/api/projects/invitations/respond")).toBeTruthy());
  expect(calls.find((call) => call.url === "/api/projects/invitations/respond")).toMatchObject({
    method: "POST",
    body: { invitation_id: 9, action: "accept" },
  });
  // the invitation is gone and the project it opened is now a card
  await waitFor(() => expect(screen.getAllByText("Plateforme Mentors")).toHaveLength(1));
  expect(document.querySelector(".stf-inv")).toBeNull();
});

test("declining sends the decline action and does not re-read the projects", async () => {
  renderView();
  await screen.findByText("Plateforme Mentors");
  const projectReads = calls.filter((call) => call.url.startsWith("/api/projects?")).length;
  fireEvent.click(screen.getByRole("button", { name: /Refuser|Decline/ }));
  await waitFor(() => expect(calls.find((call) => call.url === "/api/projects/invitations/respond")).toBeTruthy());
  expect(calls.find((call) => call.url === "/api/projects/invitations/respond").body).toEqual({ invitation_id: 9, action: "decline" });
  expect(calls.filter((call) => call.url.startsWith("/api/projects?")).length).toBe(projectReads);
});

test("search filters by name and description", async () => {
  projects = [alpha, { ...alpha, id: 6, name: "Site vitrine", meta: { description: "Refonte" } }];
  renderView();
  await screen.findByText("Site vitrine");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "refonte" } });
  expect(screen.queryByText("ImpactOS")).toBeNull();
  expect(screen.getByText("Site vitrine")).toBeTruthy();
});
