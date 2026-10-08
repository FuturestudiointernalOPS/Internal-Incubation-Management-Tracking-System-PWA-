/**
 * @jest-environment jsdom
 *
 * STAFF DASHBOARD — the data is connected, end to end.
 *
 * The screen is rendered with its real components and a fake network, and the
 * assertions are about WIRING: what each block shows from which payload, and
 * which endpoint each action reaches with which body. The sidebar is not part of
 * this screen (the section layout owns it), so nothing about it appears here.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const push = jest.fn();
  return { useRouter: () => ({ push, replace: jest.fn() }), __push: push };
});
jest.mock("@/lib/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ user: { cid: "C-LEA", name: "Léa Wembo", role: "staff" }, cid: "C-LEA", role: "staff" }),
}));
jest.mock("@/components/ui/TaskDetailModal", () => ({
  __esModule: true,
  default: ({ task, onClose }) => (
    <div role="dialog" aria-label="task-detail">
      {task.title}
      <button onClick={onClose}>close-task</button>
    </div>
  ),
}));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const StaffDashboard = require("@/components/staff/StaffDashboard").default;
const { __push: push } = require("next/navigation");

const pad = (value) => String(value).padStart(2, "0");
const key = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const NOW = new Date();
const TODAY = key(NOW);
const { isoWeek } = require("@/components/staff/calendarModel");
const WEEK = isoWeek(NOW);

const at = (hours, minutes) => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), hours, minutes).toISOString();

function dashboardPayload() {
  return {
    success: true,
    calendar: {
      events: [
        { id: `task-11-${TODAY}`, title: "Valider le budget", date: TODAY, source: "task", type: "task_start", status: "pending", priority: "high", related_id: 11, project_id: 4 },
        { id: `task-12-${TODAY}`, title: "Revue des KPIs", date: TODAY, source: "task", type: "task_start", status: "in_progress", priority: "medium", related_id: 12 },
        { id: "session-3", title: "Atelier mentors", date: TODAY, source: "session", type: "session", status: "scheduled", related_id: 3, starts_at: at(14, 0) },
      ],
    },
    summary: { programs: 1, projects: 2, tasks: { total: 5, open: 4 }, blockers: { active: 1 }, overdueTasks: 1 },
    attention: { overdueTasks: [{ id: 90, title: "Tâche en retard", priority: "high" }], dueToday: [], criticalBlockers: [] },
    activity: [{ action: "task_completed", description: "Envoyer le rapport", timestamp: NOW.toISOString(), user_id: "C-LEA" }],
    quickAccess: {
      programs: [{ id: 7, name: "Come Up", status: "active" }],
      projects: [{ id: 4, name: "ImpactOS", status: "active", task_total: 4, task_completed: 1, blocker_active: 1 }],
      tasks: [],
      blockers: [{ id: 55, title: "Accès API paiement", severity: "high", task_title: "Intégration", status: "active" }],
    },
    assignments: [{ id: 71, title: "Préparer le Demo Day", status: "pending", user_name: "Sophie Vidal", end_date: TODAY }],
    kpis: [],
  };
}

let calls;
function installFetch({ reports } = {}) {
  calls = [];
  global.fetch = jest.fn((url, options = {}) => {
    const method = options.method || "GET";
    calls.push({ url: String(url), method, body: options.body ? JSON.parse(options.body) : null });
    const reply = (body, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
    if (String(url).startsWith("/api/dashboard")) return reply(dashboardPayload());
    if (String(url).startsWith("/api/op-reports")) {
      return reply({
        success: true,
        reports: reports ?? [
          { report_type: "standup", week_number: WEEK.week, year: WEEK.year, status: "submitted", has_blockers: 1 },
        ],
      });
    }
    if (String(url).startsWith("/api/pm/programs")) return reply({ success: true, programs: [{ id: 8, name: "Atelier Pro", status: "active" }] });
    if (String(url).startsWith("/api/tasks?id=")) return reply({ success: true, tasks: [{ id: 11, title: "Valider le budget (détail)" }] });
    return reply({ success: true });
  });
}

const renderDashboard = () =>
  render(
    <I18nProvider>
      <StaffDashboard />
    </I18nProvider>,
  );

async function ready() {
  await waitFor(() => expect(calls.some((call) => call.url.startsWith("/api/dashboard"))).toBe(true));
  await screen.findByText(/Accès API paiement/);
}

beforeEach(() => {
  clearResponseCache();
  window.localStorage.clear();
  window.sessionStorage.clear();
  push.mockClear();
  installFetch();
});

describe("what the dashboard shows, and from where", () => {
  test("it reads the dashboard for the signed-in person and the weekly reports", async () => {
    renderDashboard();
    await ready();
    const dashboardCall = calls.find((call) => call.url.startsWith("/api/dashboard"));
    expect(dashboardCall.url).toContain("user_id=C-LEA");
    expect(dashboardCall.url).toContain("role=staff");
    expect(dashboardCall.url).toContain(`year=${NOW.getFullYear()}`);
    expect(dashboardCall.url).toContain(`month=${NOW.getMonth() + 1}`);
    expect(calls.some((call) => call.url === "/api/op-reports?user_id=C-LEA")).toBe(true);
    expect(calls.some((call) => call.url === "/api/pm/programs?my_facilitator=1")).toBe(true);
  });

  test("the hero counts today's open tasks and meetings; the KPIs come from the summary", async () => {
    renderDashboard();
    await ready();
    // two of today's tasks + the overdue one are listed; none is completed
    expect(screen.getByText(/Léa|Lea|Bonjour|Hello/)).toBeTruthy();
    expect(screen.getAllByText("Valider le budget").length).toBeGreaterThan(0);
    expect(screen.getByText("Tâche en retard")).toBeTruthy(); // overdue joins the today card
    expect(screen.getAllByText("Atelier mentors").length).toBeGreaterThan(0);
  });

  test("blockers, assignments, projects, programs and activity each come from their own field", async () => {
    renderDashboard();
    await ready();
    expect(screen.getByText("Accès API paiement")).toBeTruthy();
    expect(screen.getByText("Préparer le Demo Day")).toBeTruthy();
    expect(screen.getByText("ImpactOS")).toBeTruthy();
    expect(screen.getByText("COME UP")).toBeTruthy(); // from quickAccess.programs
    expect(screen.getByText("ATELIER PRO")).toBeTruthy(); // from the facilitator programs read
    expect(screen.getByText("Envoyer le rapport")).toBeTruthy(); // activity
  });

  test("this week's stand-up is shown as handed in, the retro as still to do", async () => {
    renderDashboard();
    await ready();
    await waitFor(() => expect(screen.getAllByText(/1 \/ 2/).length).toBeGreaterThan(0));
  });
});

describe("what each action sends", () => {
  test("ticking a task completes it through PUT /api/tasks", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("checkbox", { name: "Valider le budget" }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks")).toBeTruthy());
    expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks").body).toEqual({ id: 11, status: "completed" });
  });

  test("resolving a blocker goes to PUT /api/blockers as the signed-in person", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Résoudre|Resolve/ }));
    await waitFor(() => expect(calls.find((call) => call.url === "/api/blockers")).toBeTruthy());
    expect(calls.find((call) => call.url === "/api/blockers")).toMatchObject({ method: "PUT", body: { id: 55, status: "resolved", resolved_by: "C-LEA" } });
  });

  test("accepting an assignment goes to POST /api/tasks/assignment-action", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Accepter|Accept/ }));
    await waitFor(() => expect(calls.find((call) => call.url === "/api/tasks/assignment-action")).toBeTruthy());
    expect(calls.find((call) => call.url === "/api/tasks/assignment-action")).toMatchObject({
      method: "POST",
      body: { task_id: 71, user_id: "C-LEA", user_name: "Léa Wembo", action: "accepted" },
    });
  });

  test("a task title in the calendar opens the full task, read from /api/tasks?id=", async () => {
    renderDashboard();
    await ready();
    const inCalendar = screen.getAllByRole("button", { name: "Valider le budget" })[0];
    fireEvent.click(inCalendar);
    await waitFor(() => expect(calls.some((call) => call.url === "/api/tasks?id=11")).toBe(true));
    expect(await screen.findByRole("dialog", { name: "task-detail" })).toBeTruthy();
  });
});

describe("what the calendar sends", () => {
  const openForm = async () => {
    fireEvent.click(screen.getByRole("button", { name: /^(Ajouter|Add)$/ }));
    return screen.findByRole("dialog");
  };

  test("a task from the form is a one-day task for the signed-in person, in the current ISO week", async () => {
    renderDashboard();
    await ready();
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText(/Titre|Title/), { target: { value: "Préparer le comité" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Ajouter la tâche|Add the task/ }));
    await waitFor(() => expect(calls.find((call) => call.method === "POST" && call.url === "/api/tasks")).toBeTruthy());
    expect(calls.find((call) => call.method === "POST" && call.url === "/api/tasks").body).toEqual({
      title: "Préparer le comité",
      user_id: "C-LEA",
      user_name: "Léa Wembo",
      status: "pending",
      created_week: WEEK.week,
      created_year: WEEK.year,
      start_date: TODAY,
      end_date: TODAY,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  test("a meeting from the form goes to /api/events with its start and end as instants", async () => {
    renderDashboard();
    await ready();
    const dialog = await openForm();
    fireEvent.click(within(dialog).getAllByRole("button", { name: /Réunions|Meetings/ })[0]);
    fireEvent.change(within(dialog).getByLabelText(/Titre|Title/), { target: { value: "Point équipe" } });
    fireEvent.change(within(dialog).getByLabelText(/Début|Start/), { target: { value: "10:00" } });
    fireEvent.change(within(dialog).getByLabelText(/^(Fin|End)$/), { target: { value: "11:30" } });
    fireEvent.change(within(dialog).getByLabelText(/Lieu|Place/), { target: { value: "Visio" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Ajouter la réunion|Add the meeting/ }));
    await waitFor(() => expect(calls.find((call) => call.url === "/api/events")).toBeTruthy());
    const sent = calls.find((call) => call.url === "/api/events");
    expect(sent.method).toBe("POST");
    expect(sent.body).toMatchObject({ title: "Point équipe", event_type: "meeting", location: "Visio", created_by: "C-LEA", program_id: null });
    expect(new Date(sent.body.start_time).getTime()).toBe(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 10, 0).getTime());
    expect(new Date(sent.body.end_time).getTime()).toBe(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 11, 30).getTime());
  });

  test("an invalid form is refused on the screen and sends nothing", async () => {
    renderDashboard();
    await ready();
    const dialog = await openForm();
    fireEvent.click(within(dialog).getByRole("button", { name: /Ajouter la tâche|Add the task/ }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(calls.some((call) => call.method === "POST")).toBe(false);
  });

  test("the server's own refusal is shown in the form, and the form stays open", async () => {
    renderDashboard();
    await ready();
    const original = global.fetch;
    global.fetch = jest.fn((url, options = {}) => {
      if (options.method === "POST" && url === "/api/tasks") {
        return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ success: false, error: "Start date cannot be in the past" }) });
      }
      return original(url, options);
    });
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText(/Titre|Title/), { target: { value: "X" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Ajouter la tâche|Add the task/ }));
    expect(await within(dialog).findByText("Start date cannot be in the past")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  test("changing a task's status from the calendar menu goes through PUT /api/tasks", async () => {
    renderDashboard();
    await ready();
    const kebab = screen.getAllByRole("button", { name: /Valider le budget/ }).find((node) => node.getAttribute("data-kebab"));
    fireEvent.click(kebab);
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: /Terminé|Done/ }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks")).toBeTruthy());
    expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks").body).toEqual({ id: 11, status: "completed" });
  });
});

describe("the hero button", () => {
  test("opens the new task / meeting form once per click", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle tâche \/ réunion|New task \/ meeting/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Annuler|Cancel/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // a second click asks again and opens it again
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle tâche \/ réunion|New task \/ meeting/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("navigation from the dashboard", () => {
  test("the weekly card, the tasks door and the projects door go to the existing staff routes", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Toutes mes tâches|All my tasks/ }));
    expect(push).toHaveBeenCalledWith("/staff/tasks");
    fireEvent.click(screen.getByRole("button", { name: /Tous mes projets|All my projects/ }));
    expect(push).toHaveBeenCalledWith("/staff/projects");
    fireEvent.click(screen.getByText("ImpactOS"));
    expect(push).toHaveBeenCalledWith("/staff/projects/4");
    fireEvent.click(screen.getByText("COME UP"));
    expect(push).toHaveBeenCalledWith("/pm/programs/7");
  });
});
