"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BarChart3, FolderKanban, ListChecks, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useSessionUser } from "@/lib/hooks/useSessionUser";
import TaskDetailModal from "@/components/ui/TaskDetailModal";
import { pickDashboard } from "@/components/dashboard/unified-dashboard/constants";
import StaffCalendar from "./StaffCalendar";
import {
  AssignmentsCard,
  BlockersCard,
  MeetingsCard,
  OperationsSection,
  ProgramsSection,
  ProjectsCard,
  RegularitySection,
  ShortcutsSection,
  TodayTasksCard,
  WeeklyReportsCard,
} from "./DashboardCards";
import { buildMeetingPayload, buildTaskPayload, dateKey, isoWeek, normalizeEvents } from "./calendarModel";
import { operationTotals, recentWeeks, regularity, todayTasks, uniquePrograms, weekRecord } from "./dashboardModel";
import { notify } from "./notify";

// Module scope: the data hook keys its read on these, so inline arrows would
// refetch on every render.
const pickReports = (payload) => (payload?.success ? payload.reports || [] : []);
const pickPrograms = (payload) => (payload?.success ? payload.programs || [] : []);
const EMPTY = [];

const monthUrl = (cid, role, month) =>
  cid && month
    ? `/api/dashboard?user_id=${encodeURIComponent(cid)}&role=${encodeURIComponent(role)}&year=${month.year}&month=${month.month + 1}`
    : null;

/** A write to the API, answered as `{ ok, error }` (the server's own message is kept). */
async function send(url, method, body) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) return { ok: false, error: data.error || data.message || null };
    return { ok: true, data };
  } catch {
    return { ok: false, error: null };
  }
}

/**
 * STAFF DASHBOARD — the staff's one dashboard.
 *
 * Everything on it is read from the same sources the previous dashboard used
 * (`/api/dashboard` for the calendar, the counters, the blockers, the
 * assignments and the projects; `/api/op-reports` for the weekly stand-up and
 * retro), and every action goes to the same endpoints (`/api/tasks`,
 * `/api/blockers`, `/api/tasks/assignment-action`, `/api/events`). The sidebar
 * belongs to the section layout and is not touched here.
 */
export default function StaffDashboard() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, cid } = useSessionUser();
  const role = user?.role || "staff";

  const [now] = useState(() => new Date());
  const [months, setMonths] = useState(() => [{ year: now.getFullYear(), month: now.getMonth() }]);
  const [formRequest, setFormRequest] = useState(null);
  const [openTask, setOpenTask] = useState(null);
  const [busyTask, setBusyTask] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [sectionOpen, setSectionOpen] = useState(true);

  // The month the calendar is on, and — when a week reaches into another month —
  // that month as well. Each answers the same question, so a screen with only
  // one of them still has every figure it needs.
  const first = months[0];
  const second = months[1] || null;
  const primary = useApi(monthUrl(cid, role, first), {
    defaultValue: null,
    transform: pickDashboard,
    deps: [cid, role, first?.year, first?.month],
  });
  const secondary = useApi(monthUrl(cid, role, second), {
    defaultValue: null,
    transform: pickDashboard,
    deps: [cid, role, second?.year, second?.month],
  });
  const data = primary.data || secondary.data;

  const reportsRead = useApi(cid ? `/api/op-reports?user_id=${encodeURIComponent(cid)}` : null, {
    defaultValue: EMPTY,
    transform: pickReports,
    deps: [cid],
  });
  const facilitatorRead = useApi(cid ? "/api/pm/programs?my_facilitator=1" : null, {
    defaultValue: EMPTY,
    transform: pickPrograms,
    deps: [cid],
  });

  const refreshAll = useCallback(() => {
    primary.refresh();
    if (second) secondary.refresh();
  }, [primary, secondary, second]);

  // ── What the calendar draws ──
  const events = useMemo(() => {
    const merged = new Map();
    for (const source of [primary.data, secondary.data]) {
      for (const event of source?.calendar?.events || []) merged.set(String(event.id), event);
    }
    return [...merged.values()];
  }, [primary.data, secondary.data]);
  const items = useMemo(() => normalizeEvents(events), [events]);

  const onRangeChange = useCallback((needed) => {
    setMonths((previous) => {
      const same = previous.length === needed.length && previous.every((month, index) => month.year === needed[index].year && month.month === needed[index].month);
      return same ? previous : needed.slice(0, 2);
    });
  }, []);

  // ── Derived figures ──
  const todayKey = dateKey(now);
  const summary = data?.summary || {};
  const quick = data?.quickAccess || {};
  const reports = reportsRead.data;
  const programs = useMemo(() => uniquePrograms(quick.programs, facilitatorRead.data), [quick.programs, facilitatorRead.data]);
  const record = useMemo(() => recentWeeks(now).map((week) => weekRecord(reports, week)), [reports, now]);
  const thisWeek = isoWeek(now);
  const currentWeek = record[record.length - 1];
  const standing = regularity(record, now);
  const tasks = useMemo(() => todayTasks(items, todayKey, data?.attention?.overdueTasks), [items, todayKey, data]);
  const meetings = useMemo(() => items.filter((item) => item.kind === "meeting" && item.key === todayKey), [items, todayKey]);
  const openCount = tasks.filter((task) => task.status !== "completed").length;
  const firstName = String(user?.name || "").trim().split(/\s+/)[0] || "";
  const activePrograms = programs.filter((program) => !program.status || /active|actif/i.test(String(program.status))).length || programs.length;

  // ── Actions ──
  const setStatus = useCallback(
    async (taskId, status) => {
      const result = await send("/api/tasks", "PUT", { id: taskId, status });
      if (result.ok) refreshAll();
      return result;
    },
    [refreshAll],
  );

  const onToggleTask = async (task, checked) => {
    setBusyTask(task.id);
    const result = await setStatus(task.id, checked ? "completed" : "pending");
    setBusyTask(null);
    if (!result.ok) notify("error", result.error || t("staffMisc.front.calendar.statusFailed"));
  };

  const onResolveBlocker = async (blockerId) => {
    setResolving(blockerId);
    const result = await send("/api/blockers", "PUT", { id: blockerId, status: "resolved", resolved_by: cid });
    setResolving(null);
    if (result.ok) refreshAll();
    else notify("error", result.error || t("staffMisc.front.dashboard.actionFailed"));
  };

  const onAssignmentAction = async (taskId, action) => {
    setActionId(taskId);
    const result = await send("/api/tasks/assignment-action", "POST", {
      task_id: taskId,
      user_id: cid,
      user_name: user?.name,
      action,
    });
    setActionId(null);
    if (result.ok) refreshAll();
    else notify("error", result.error || t("staffMisc.front.dashboard.actionFailed"));
  };

  const onCreateTask = async (form) => {
    const result = await send("/api/tasks", "POST", buildTaskPayload(form, { cid, name: user?.name }, new Date()));
    if (result.ok) refreshAll();
    return result;
  };
  const onCreateMeeting = async (form) => {
    const result = await send("/api/events", "POST", buildMeetingPayload(form, { cid }));
    if (result.ok) refreshAll();
    return result;
  };

  // A task opened from the calendar is read in full first, as the old calendar did.
  const onOpenTask = async (item) => {
    try {
      const response = await fetch(`/api/tasks?id=${encodeURIComponent(item.relatedId)}`);
      const payload = await response.json();
      if (payload.success && payload.tasks?.[0]) setOpenTask(payload.tasks[0]);
    } catch {
      notify("error", t("staffMisc.front.dashboard.actionFailed"));
    }
  };

  const ask = (type) => setFormRequest({ id: Date.now(), type });
  const go = (route) => router.push(route);
  const loading = !cid || primary.loading;

  return (
    <div className="stf" style={{ paddingBottom: 60 }}>
      {/* Hero */}
      <div className="stf-hero">
        <div>
          <div className="stf-k">
            {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h2>
            {firstName
              ? t("staffMisc.front.dashboard.hello", { name: firstName, count: openCount })
              : t("staffMisc.front.dashboard.helloAnon", { count: openCount })}
          </h2>
          <p>{t("staffMisc.front.dashboard.heroSub", { programs: activePrograms, meetings: meetings.length })}</p>
        </div>
        <button type="button" className="stf-btn pr" onClick={() => ask()}>
          {t("staffMisc.front.dashboard.newItem")}
        </button>
      </div>

      {/* KPIs */}
      <div className="stf-grid">
        {[
          [t("staffMisc.front.dashboard.kpiPrograms"), activePrograms, FolderKanban],
          [t("staffMisc.front.dashboard.kpiProjects"), summary.projects || 0, Users],
          [t("staffMisc.front.dashboard.kpiTasks"), summary.tasks?.open || 0, ListChecks],
          [t("staffMisc.front.dashboard.kpiReports"), `${(currentWeek.standup ? 1 : 0) + (currentWeek.retro ? 1 : 0)} / 2`, BarChart3],
        ].map(([label, value, Icon]) => (
          <div key={label} className="stf-card stf-kpi">
            <div className="stf-k">
              <span>{label}</span>
              <Icon size={15} />
            </div>
            <div className="big">{loading ? "…" : value}</div>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <StaffCalendar
        events={events}
        now={now}
        loading={loading}
        onRangeChange={onRangeChange}
        onOpenTask={onOpenTask}
        onSetStatus={(item, status) => setStatus(item.relatedId, status)}
        onCreateTask={onCreateTask}
        onCreateMeeting={onCreateMeeting}
        formRequest={formRequest}
      />

      {/* Today */}
      <div className="stf-grid g3">
        <TodayTasksCard tasks={tasks} busyId={busyTask} onToggle={onToggleTask} onAdd={() => ask("task")} onOpenAll={() => go("/staff/tasks")} />
        <MeetingsCard meetings={meetings} onAdd={() => ask("meeting")} />
        <WeeklyReportsCard
          week={thisWeek}
          status={currentWeek}
          regularity={standing}
          loading={reportsRead.loading}
          onOpen={(tab) => go(`/staff/op-report?tab=${tab}`)}
        />
      </div>

      <div className="stf-grid g3">
        <BlockersCard blockers={quick.blockers || EMPTY} resolvingId={resolving} onResolve={onResolveBlocker} onOpenAll={() => go("/staff/op-report?tab=summary")} />
        {(data?.assignments || []).length > 0 ? (
          <AssignmentsCard assignments={data.assignments} actionId={actionId} onAction={onAssignmentAction} onOpenAll={() => go("/staff/tasks")} />
        ) : (
          <div className="stf-card">
            <h3>
              <AlertTriangle size={16} />
              {t("dashboard.assignedToMe")}
            </h3>
            <div className="stf-empty">{t("staffMisc.front.dashboard.noAssignments")}</div>
          </div>
        )}
        <ProjectsCard projects={quick.projects || EMPTY} onOpen={(project) => go(`/staff/projects/${project.id}`)} onOpenAll={() => go("/staff/projects")} />
      </div>

      {/* Sections A–D */}
      <ProgramsSection
        activity={data?.activity || EMPTY}
        programs={programs}
        onOpenProgram={(program) => go(`/pm/programs/${program.id}`)}
        onOpenAll={() => go("/pm/programs")}
      />
      <OperationsSection totals={operationTotals(reports)} summary={summary} onGo={go} />
      <RegularitySection record={record} regularity={standing} open={sectionOpen} onToggle={() => setSectionOpen(!sectionOpen)} />
      <ShortcutsSection onGo={go} />

      {openTask && <TaskDetailModal task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  );
}
