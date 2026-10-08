"use client";

import KpiCard from "@/components/ui/KpiCard";
import { useMemo, useState } from "react";
import { Ban, Check, ChevronRight, ListChecks, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import { useDialogs } from "@/components/ui/DialogProvider";
import TaskDetailModal from "@/components/ui/TaskDetailModal";
import { TASK_STATUSES, buildTaskPayload, dateKey } from "./calendarModel";
import { filterTasks, nextStatus, sortTasks, taskDay, taskKpis, topLevelTasks, isOverdue } from "./tasksModel";
import { notify } from "./notify";

// Module scope: the data hook keys its read on these.
const pickTasks = (payload) => (payload?.success ? payload.tasks || [] : []);
const pickProjects = (payload) => {
  if (!payload?.success) return [];
  return [...(payload.owned || []), ...(payload.collab || []), ...(payload.all_active || [])];
};
const EMPTY = [];
const PAGE = 25;
const TONE = { pending: "", in_progress: "b", blocked: "r", completed: "g", carried_over: "o" };

async function send(url, method, body) {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) return { ok: false, error: data.error || null };
    return { ok: true };
  } catch {
    return { ok: false, error: null };
  }
}

/**
 * MY TASKS — every task of the signed-in person, one table.
 *
 * Reads:   GET /api/tasks?user_id=…   and   GET /api/projects/assignments?user_cid=…
 *          (the second only to name the project of each task)
 * Writes:  PUT /api/tasks {id, status}            advance / block
 *          POST /api/tasks                        add (same body as the calendar's)
 *          DELETE /api/tasks?id=…&user_id=…       delete, after a confirmation
 * The server's own rules (locked tasks, active blockers, dates) are the only
 * rules: a refusal is shown as the server wrote it.
 */
export default function TasksView() {
  const { t, lang } = useI18n();
  const { user, cid } = useSessionUser();
  const { confirm } = useDialogs();
  const [now] = useState(() => new Date());
  const todayKey = dateKey(now);
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(todayKey);
  const [error, setError] = useState("");

  const tasksRead = useApi(cid ? `/api/tasks?user_id=${encodeURIComponent(cid)}&sort=oldest` : null, {
    defaultValue: EMPTY,
    transform: pickTasks,
    deps: [cid],
  });
  const projectsRead = useApi(cid ? `/api/projects/assignments?user_cid=${encodeURIComponent(cid)}` : null, {
    defaultValue: EMPTY,
    transform: pickProjects,
    deps: [cid],
  });

  const projectNames = useMemo(() => new Map(projectsRead.data.map((project) => [String(project.id), project.name])), [projectsRead.data]);
  const tasks = useMemo(() => topLevelTasks(tasksRead.data), [tasksRead.data]);
  const kpis = taskKpis(tasks, todayKey);
  const rows = useMemo(() => sortTasks(filterTasks(tasks, { status, query, projectNames })), [tasks, status, query, projectNames]);
  const loading = !cid || (tasksRead.loading && tasksRead.data.length === 0);

  const setTaskStatus = async (task, next) => {
    setBusy(task.id);
    const result = await send("/api/tasks", "PUT", { id: task.id, status: next });
    setBusy(null);
    if (result.ok) tasksRead.refresh();
    else notify("error", result.error || t("staffMisc.front.calendar.statusFailed"));
  };

  const remove = async (task) => {
    if (!(await confirm({ message: t("staffMisc.front.tasks.deleteConfirm", { title: task.title }), tone: "danger" }))) return;
    setBusy(task.id);
    const result = await send(`/api/tasks?id=${encodeURIComponent(task.id)}&user_id=${encodeURIComponent(cid)}`, "DELETE");
    setBusy(null);
    if (result.ok) {
      tasksRead.refresh();
      notify("success", t("staffMisc.front.tasks.deleted"));
    } else notify("error", result.error || t("staffMisc.front.dashboard.actionFailed"));
  };

  const open = async (task) => {
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(task.id)}`);
      const payload = await response.json();
      if (payload.success && payload.tasks?.[0]) setOpenTask(payload.tasks[0]);
    } catch {
      notify("error", t("staffMisc.front.dashboard.actionFailed"));
    }
  };

  const add = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      setError(t("staffMisc.front.calendar.error.titleTask"));
      return;
    }
    const result = await send("/api/tasks", "POST", buildTaskPayload({ title, date: dueDate, status: "pending" }, { cid, name: user?.name }, now));
    if (!result.ok) {
      setError(result.error || t("staffMisc.front.calendar.error.save"));
      return;
    }
    setTitle("");
    setError("");
    setAdding(false);
    tasksRead.refresh();
    notify("success", t("staffMisc.front.tasks.added"));
  };

  const tabs = ["all", ...TASK_STATUSES];
  const count = (value) => (value === "all" ? tasks.length : tasks.filter((task) => task.status === value).length);

  return (
    <>
      <div className="stf-head">
        <div>
          <h1 className="stf-title">{t("staffMisc.front.tasks.title")}</h1>
          <p className="stf-sub">{t("staffMisc.front.tasks.subtitle")}</p>
        </div>
        <button type="button" className="stf-btn pr" onClick={() => setAdding(!adding)}>
          <Plus size={15} /> {t("staffMisc.front.tasks.new")}
        </button>
      </div>

      {adding && (
        <form className="stf-card" onSubmit={add} style={{ marginBottom: 16 }} noValidate>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr auto", alignItems: "end" }}>
            <div className="stf-field">
              <label className="stf-k" htmlFor="stf-t-title">{t("staffMisc.front.calendar.fieldTitle")}</label>
              <input id="stf-t-title" className="stf-input" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); setError(""); }} placeholder={t("staffMisc.front.calendar.placeholderTask")} />
            </div>
            <div className="stf-field">
              <label className="stf-k" htmlFor="stf-t-date">{t("staffMisc.front.tasks.due")}</label>
              <input id="stf-t-date" type="date" className="stf-input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <button type="submit" className="stf-btn pr">{t("staffMisc.front.calendar.addTask")}</button>
          </div>
          {error && <p className="stf-err" role="alert" style={{ marginTop: 8 }}>{error}</p>}
        </form>
      )}

      <div className="stf-grid">
        {[
          [t("staffMisc.front.tasks.kpiOpen"), kpis.open],
          [t("staffMisc.front.tasks.kpiBlocked"), kpis.blocked],
          [t("staffMisc.front.tasks.kpiDone"), kpis.done],
          [t("staffMisc.front.tasks.kpiOverdue"), kpis.overdue],
        ].map(([label, value]) => (
          <KpiCard key={label} label={label} value={value} icon={ListChecks} loading={loading} />
        ))}
      </div>

      <div className="stf-bar">
        <div className="stf-tabs" role="tablist">
          {tabs.map((value) => (
            <button key={value} type="button" role="tab" aria-selected={status === value} className={status === value ? "on" : ""} onClick={() => { setStatus(value); setShown(PAGE); }}>
              {value === "all" ? t("staffMisc.front.tasks.all") : t(`staffMisc.front.status.${value}`)} ({count(value)})
            </button>
          ))}
        </div>
        <input className="stf-input" value={query} onChange={(event) => { setQuery(event.target.value); setShown(PAGE); }} placeholder={t("common.search")} aria-label={t("common.search")} />
      </div>

      <div className="stf-tw">
        <table>
          <thead>
            <tr>
              <th>{t("staffMisc.front.tasks.task")}</th>
              <th>{t("staffMisc.front.tasks.project")}</th>
              <th>{t("staffMisc.front.tasks.due")}</th>
              <th>{t("staffMisc.front.tasks.status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="stf-empty">{t("common.loading")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="stf-empty">{t("staffMisc.front.tasks.empty")}</td></tr>
            ) : (
              rows.slice(0, shown).map((task) => {
                const next = nextStatus(task.status);
                const late = isOverdue(task, todayKey);
                return (
                  <tr key={task.id}>
                    <td>
                      <button type="button" onClick={() => open(task)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", fontWeight: 700, textDecoration: task.status === "completed" ? "line-through" : "none", opacity: task.status === "completed" ? 0.6 : 1 }}>
                        {task.title}
                      </button>
                    </td>
                    <td>{projectNames.get(String(task.project_id)) || "—"}</td>
                    <td>
                      {taskDay(task.end_date) ? new Date(`${taskDay(task.end_date)}T00:00:00`).toLocaleDateString(lang, { day: "2-digit", month: "short" }) : "—"}
                      {late && <span className="stf-tag r" style={{ marginLeft: 6 }}>{t("staffMisc.front.dashboard.late")}</span>}
                    </td>
                    <td><span className={`stf-tag ${TONE[task.status] || ""}`}>{t(`staffMisc.front.status.${task.status}`)}</span></td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {next && (
                        <button type="button" className="stf-btn sm ok" disabled={busy === task.id} onClick={() => setTaskStatus(task, next)}>
                          <Check size={13} /> {t("staffMisc.front.tasks.advance")}
                        </button>
                      )}{" "}
                      {task.status !== "blocked" && task.status !== "completed" && (
                        <button type="button" className="stf-btn sm rj" disabled={busy === task.id} onClick={() => setTaskStatus(task, "blocked")}>
                          <Ban size={13} /> {t("staffMisc.front.tasks.block")}
                        </button>
                      )}{" "}
                      <button type="button" className="stf-btn sm rj" aria-label={t("staffMisc.front.tasks.delete")} disabled={busy === task.id} onClick={() => remove(task)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button type="button" className="stf-btn" onClick={() => setShown(shown + PAGE)}>
            {t("staffMisc.front.tasks.showMore", { count: rows.length - shown })} <ChevronRight size={14} />
          </button>
        </div>
      )}
      {openTask && <TaskDetailModal task={openTask} onClose={() => { setOpenTask(null); tasksRead.refresh(); }} />}
    </>
  );
}
