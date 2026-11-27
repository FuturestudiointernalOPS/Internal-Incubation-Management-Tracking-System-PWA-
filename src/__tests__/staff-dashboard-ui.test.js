/**
 * @jest-environment jsdom
 *
 * STAFF DASHBOARD — the data is connected, end to end.
 *
 * Layout: the hero, "This week" and "Needs you today" (tasks, blockers,
 * meetings, assignments — each a closed fold showing two rows), the shortcuts,
 * a folded history. The calendar is a modal: the compact one ("Open calendar"),
 * and the full one behind its "Full calendar" link.
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
const StaffDashboard = require("@/spaces/staff/core/components/StaffDashboard").default;
const { __push: push } = require("next/navigation");

const pad = (value) => String(value).padStart(2, "0");
const key = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const NOW = new Date();
const TODAY = key(NOW);
const { isoWeek } = require("@/components/shared/calendar/calendarModel");
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

const seeAll = () => {
  for (const button of screen.queryAllByRole("button", { name: /Tout voir|See all/ })) fireEvent.click(button);
};
const openCompactCalendar = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Ouvrir le calendrier|Open calendar/ }));
  return screen.findByRole("dialog");
};

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

  test("the hero greets the person; the removed blocks are gone", async () => {
    renderDashboard();
    await ready();
    expect(screen.getByText(/Léa|Lea|Bonjour|Hello/)).toBeTruthy();
    // KPI tiles, the programs list, the projects card and the internal-operations
    // block no longer sit on the dashboard.
    expect(screen.queryByText("COME UP")).toBeNull();
    expect(screen.queryByText("ATELIER PRO")).toBeNull();
    expect(screen.queryByText("ImpactOS")).toBeNull();
    expect(screen.queryByText(/1 \/ 2/)).toBeNull();
  });

  test("tasks, meetings, blockers and assignments each come from their own field, folded", async () => {
    renderDashboard();
    await ready();
    seeAll();
    expect(screen.getByText("Valider le budget")).toBeTruthy();
    expect(screen.getByText("Tâche en retard")).toBeTruthy(); // overdue joins today's tasks
    expect(screen.getByText("Atelier mentors")).toBeTruthy(); // today's meeting
    expect(screen.getByText("Accès API paiement")).toBeTruthy();
    expect(screen.getByText("Préparer le Demo Day")).toBeTruthy();
    expect(screen.getByText("Envoyer le rapport")).toBeTruthy(); // recent activity, in the history fold
  });

  test("every fold is closed on arrival, and the two cards are not folds", async () => {
    const { container } = renderDashboard();
    await ready();
    const folds = container.querySelectorAll("details.stf-fold");
    expect(folds.length).toBeGreaterThanOrEqual(4); // tasks, blockers, meetings, assignments (+ history)
    folds.forEach((fold) => expect(fold.hasAttribute("open")).toBe(false));
    expect(screen.getByText(/Needs you today|À faire aujourd'hui/).closest("details")).toBeNull();
    expect(screen.getByText(/This week|Cette semaine/).closest("details")).toBeNull();
  });

  test("a fold shows two rows and the rest behind See all", async () => {
    renderDashboard();
    await ready();
    expect(screen.queryAllByRole("checkbox").length).toBe(2);
    seeAll();
    expect(screen.queryAllByRole("checkbox").length).toBe(3);
  });

  test("the week strip shows seven days with today marked", async () => {
    const { container } = renderDashboard();
    await ready();
    expect(container.querySelectorAll(".stf-wday").length).toBe(7);
    expect(container.querySelectorAll(".stf-wday.today").length).toBe(1);
  });

  test("the shortcuts are forms, messages and Weekly Ops — no projects, no tasks, no report history", async () => {
    renderDashboard();
    await ready();
    expect(screen.queryByText(/Mes projets|My projects/)).toBeNull();
    expect(screen.getByText(/^Forms$|^Formulaires$/)).toBeTruthy();
    expect(screen.getByText(/^Messages$|^Messagerie$/)).toBeTruthy();
    expect(screen.getAllByText(/Weekly Ops/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/My report history|Mon historique de rapports/)).toBeNull();
  });
});

describe("what each action sends", () => {
  test("ticking a task completes it through PUT /api/tasks", async () => {
    renderDashboard();
    await ready();
    seeAll();
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
});

describe("the calendar", () => {
  test("Open calendar shows the compact month and today's events", async () => {
    renderDashboard();
    await ready();
    const dialog = await openCompactCalendar();
    expect(within(dialog).getAllByText(/My calendar|Mon calendrier/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Valider le budget")).toBeTruthy();
    expect(within(dialog).getByText("Atelier mentors")).toBeTruthy();
    expect(within(dialog).getByText(/Full calendar|Calendrier complet/)).toBeTruthy();
  });

  test("a task in the compact calendar opens the full task, read from /api/tasks?id=", async () => {
    renderDashboard();
    await ready();
    const dialog = await openCompactCalendar();
    fireEvent.click(within(dialog).getByText("Valider le budget"));
    await waitFor(() => expect(calls.some((call) => call.url === "/api/tasks?id=11")).toBe(true));
    expect(await screen.findByRole("dialog", { name: "task-detail" })).toBeTruthy();
  });

  test("moving to another month reads that month", async () => {
    renderDashboard();
    await ready();
    const dialog = await openCompactCalendar();
    fireEvent.click(within(dialog).getByRole("button", { name: /Next|Suivant/ }));
    const next = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1);
    await waitFor(() =>
      expect(calls.some((call) => call.url.startsWith("/api/dashboard") && call.url.includes(`year=${next.getFullYear()}`) && call.url.includes(`month=${next.getMonth() + 1}`))).toBe(true),
    );
  });

  test("Full calendar opens the full one, and a task status changes through PUT /api/tasks", async () => {
    renderDashboard();
    await ready();
    const dialog = await openCompactCalendar();
    fireEvent.click(within(dialog).getByText(/Full calendar|Calendrier complet/));
    const kebab = (await screen.findAllByRole("button", { name: /Valider le budget/ })).find((node) => node.getAttribute("data-kebab"));
    fireEvent.click(kebab);
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitemradio", { name: /Terminé|Done/ }));
    await waitFor(() => expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks")).toBeTruthy());
    expect(calls.find((call) => call.method === "PUT" && call.url === "/api/tasks").body).toEqual({ id: 11, status: "completed" });
  });
});

describe("what the creation form sends", () => {
  const openForm = async () => {
    fireEvent.click(screen.getByRole("button", { name: /Nouvelle tâche \/ réunion|New task \/ meeting/ }));
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

  test("the Schedule button of the Meetings fold opens the form on a meeting", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Planifier|Schedule/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Lieu|Place/)).toBeTruthy();
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
  test("the tasks and blockers doors, and the Weekly Ops shortcut, go to the existing staff routes", async () => {
    renderDashboard();
    await ready();
    fireEvent.click(screen.getByRole("button", { name: /Toutes mes tâches|All my tasks/ }));
    expect(push).toHaveBeenCalledWith("/staff/tasks");
    fireEvent.click(screen.getByRole("button", { name: /Voir tous les blocages|See all blockers/ }));
    expect(push).toHaveBeenCalledWith("/staff/op-report?tab=summary");
    fireEvent.click(screen.getByText(/Open my stand-ups|Ouvrir mes stand-ups/));
    expect(push).toHaveBeenCalledWith("/staff/op-report?tab=standup");
  });
});
