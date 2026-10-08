/**
 * @jest-environment jsdom
 *
 * STAFF — MY TASKS. The pure ordering/counting rules, then the screen with a fake
 * network: what it reads, and the exact request each action sends.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockConfirm = jest.fn(async () => true);
jest.mock("@/components/ui/DialogProvider", () => ({ useDialogs: () => ({ confirm: mockConfirm }) }));
jest.mock("@/lib/hooks/useSessionUser", () => ({
  useSessionUser: () => ({ user: { cid: "C-LEA", name: "Léa Wembo", role: "staff" }, cid: "C-LEA", role: "staff" }),
}));
jest.mock("@/components/ui/TaskDetailModal", () => ({
  __esModule: true,
  default: ({ task }) => <div role="dialog" aria-label="task-detail">{task.title}</div>,
}));

const { I18nProvider } = require("@/lib/i18n");
const { clearResponseCache } = require("@/lib/hooks/useApi");
const TasksView = require("@/components/staff/TasksView").default;
const model = require("@/components/staff/tasksModel");
const { isoWeek } = require("@/components/staff/calendarModel");

const NOW = new Date();
const pad = (value) => String(value).padStart(2, "0");
const TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;

describe("tasks model", () => {
  const tasks = [
    { id: 1, title: "Done", status: "completed", end_date: "2026-01-01" },
    { id: 2, title: "Waiting", status: "pending", end_date: "2026-03-01" },
    { id: 3, title: "Stuck", status: "blocked", end_date: "2026-05-01T00:00:00.000Z" },
    { id: 4, title: "Active early", status: "in_progress", end_date: "2026-02-01" },
    { id: 5, title: "Sub", status: "pending", parent_task_id: 2 },
    { id: 6, title: "Gone", status: "archived" },
  ];

  test("only top-level, non-archived tasks count", () => {
    expect(model.topLevelTasks(tasks).map((task) => task.id)).toEqual([1, 2, 3, 4]);
  });

  test("open work first (blocked, active, waiting), by due date; finished last", () => {
    expect(model.sortTasks(model.topLevelTasks(tasks)).map((task) => task.id)).toEqual([3, 4, 2, 1]);
  });

  test("advancing: waiting → active → done, and done stays done", () => {
    expect(model.nextStatus("pending")).toBe("in_progress");
    expect(model.nextStatus("blocked")).toBe("in_progress");
    expect(model.nextStatus("in_progress")).toBe("completed");
    expect(model.nextStatus("completed")).toBeNull();
  });

  test("overdue means due before today and not finished", () => {
    expect(model.isOverdue(tasks[1], "2026-04-01")).toBe(true);
    expect(model.isOverdue(tasks[0], "2026-04-01")).toBe(false);
    expect(model.isOverdue(tasks[2], "2026-04-01")).toBe(false);
    expect(model.taskKpis(model.topLevelTasks(tasks), "2026-04-01")).toEqual({ open: 3, blocked: 1, done: 1, overdue: 2 });
  });

  test("filter by status and by text (title or project name)", () => {
    const projectNames = new Map([["9", "Alpha"]]);
    const list = [{ id: 1, title: "Write", status: "pending", project_id: 9 }, { id: 2, title: "Read", status: "blocked" }];
    expect(model.filterTasks(list, { status: "blocked", query: "", projectNames }).map((task) => task.id)).toEqual([2]);
    expect(model.filterTasks(list, { status: "all", query: "alpha", projectNames }).map((task) => task.id)).toEqual([1]);
  });
});

let calls;
let list;
function installFetch() {
  calls = [];
  global.fetch = jest.fn((url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body ? JSON.parse(options.body) : null });
    const reply = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    if (String(url).startsWith("/api/tasks?user_id=")) return reply({ success: true, tasks: list });
    if (String(url).startsWith("/api/tasks?id=")) return reply({ success: true, tasks: [{ id: 3, title: "Stuck (full)" }] });
    if (String(url).startsWith("/api/projects/assignments")) return reply({ success: true, owned: [{ id: 9, name: "ImpactOS" }], collab: [], all_active: [] });
    return reply({ success: true });
  });
}

beforeEach(() => {
  clearResponseCache();
  mockConfirm.mockClear();
  list = [
    { id: 2, title: "Waiting task", status: "pending", end_date: "2000-03-01", project_id: 9 },
    { id: 3, title: "Stuck task", status: "blocked", end_date: TODAY },
    { id: 1, title: "Finished task", status: "completed", end_date: "2000-01-01" },
    { id: 8, title: "A subtask", status: "pending", parent_task_id: 2 },
  ];
  installFetch();
});

const renderView = () => render(<I18nProvider><TasksView /></I18nProvider>);

test("it reads the person's tasks and names their project", async () => {
  renderView();
  expect(await screen.findByText("Waiting task")).toBeTruthy();
  expect(calls.some((call) => call.url === "/api/tasks?user_id=C-LEA&sort=oldest")).toBe(true);
  expect(calls.some((call) => call.url === "/api/projects/assignments?user_cid=C-LEA")).toBe(true);
  expect(screen.getByText("ImpactOS")).toBeTruthy();
  expect(screen.queryByText("A subtask")).toBeNull(); // tracked through its parent
});

test("the counters: open, blocked, done, overdue", async () => {
  renderView();
  await screen.findByText("Waiting task");
  expect([...document.querySelectorAll(".stf-kpi .big")].map((node) => node.textContent)).toEqual(["2", "1", "1", "1"]);
});

test("advancing a task is PUT /api/tasks with its next status", async () => {
  renderView();
  const row = (await screen.findByText("Waiting task")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /Avancer|Advance/ }));
  await waitFor(() => expect(calls.find((call) => call.method === "PUT")).toBeTruthy());
  expect(calls.find((call) => call.method === "PUT")).toMatchObject({ url: "/api/tasks", body: { id: 2, status: "in_progress" } });
});

test("blocking a task is PUT /api/tasks with status blocked", async () => {
  renderView();
  const row = (await screen.findByText("Waiting task")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /Bloquer|Block/ }));
  await waitFor(() => expect(calls.find((call) => call.method === "PUT")).toBeTruthy());
  expect(calls.find((call) => call.method === "PUT").body).toEqual({ id: 2, status: "blocked" });
});

test("deleting asks first, then sends DELETE with the task and the person", async () => {
  renderView();
  const row = (await screen.findByText("Waiting task")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /Supprimer|Delete/ }));
  await waitFor(() => expect(calls.find((call) => call.method === "DELETE")).toBeTruthy());
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  expect(calls.find((call) => call.method === "DELETE").url).toBe("/api/tasks?id=2&user_id=C-LEA");
});

test("a declined confirmation sends nothing", async () => {
  mockConfirm.mockResolvedValueOnce(false);
  renderView();
  const row = (await screen.findByText("Waiting task")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /Supprimer|Delete/ }));
  await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
  expect(calls.some((call) => call.method === "DELETE")).toBe(false);
});

test("a task title opens the full task read by id", async () => {
  renderView();
  fireEvent.click(await screen.findByText("Stuck task"));
  await waitFor(() => expect(calls.some((call) => call.url === "/api/tasks?id=3")).toBe(true));
  expect(await screen.findByRole("dialog", { name: "task-detail" })).toBeTruthy();
});

test("adding a task sends the same body the calendar sends", async () => {
  renderView();
  await screen.findByText("Waiting task");
  fireEvent.click(screen.getByRole("button", { name: /Nouvelle tâche|New task/ }));
  fireEvent.change(screen.getByLabelText(/Titre|Title/), { target: { value: "Écrire le bilan" } });
  fireEvent.click(screen.getByRole("button", { name: /Ajouter la tâche|Add the task/ }));
  await waitFor(() => expect(calls.find((call) => call.method === "POST")).toBeTruthy());
  const week = isoWeek(NOW);
  expect(calls.find((call) => call.method === "POST")).toMatchObject({
    url: "/api/tasks",
    body: { title: "Écrire le bilan", user_id: "C-LEA", user_name: "Léa Wembo", status: "pending", created_week: week.week, created_year: week.year, start_date: TODAY, end_date: TODAY },
  });
});

test("a status tab narrows the table", async () => {
  renderView();
  await screen.findByText("Waiting task");
  fireEvent.click(screen.getByRole("tab", { name: /Bloqué|Blocked/ }));
  expect(screen.queryByText("Waiting task")).toBeNull();
  expect(screen.getByText("Stuck task")).toBeTruthy();
});
