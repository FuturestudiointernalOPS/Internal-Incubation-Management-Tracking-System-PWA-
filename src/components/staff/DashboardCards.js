"use client";

import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderKanban,
  Mic,
  Plus,
  RefreshCw,
  Target,
  Video,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import SectionHead from "@/components/ui/SectionHead";
import LinkCard from "@/components/ui/LinkCard";
import StatusCard from "@/components/ui/StatusCard";
import KpiCard from "@/components/ui/KpiCard";
import { timeLabel } from "./calendarModel";

const initial = (name) => String(name || "?").trim().charAt(0).toUpperCase() || "?";

/** Today's tasks, tickable. Ticking asks the screen to set the task completed (or back to pending). */
export function TodayTasksCard({ tasks, busyId, onToggle, onAdd, onOpenAll }) {
  const { t } = useI18n();
  const done = tasks.filter((task) => task.status === "completed").length;
  return (
    <div className="stf-card">
      <h3>
        <CheckCircle2 size={16} />
        {t("staffMisc.front.dashboard.todayTasks")}
        <span className="stf-tag o" style={{ marginLeft: "auto" }}>
          {done}/{tasks.length}
        </span>
      </h3>
      <div className="stf-bar-prog">
        <i style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
      </div>
      {tasks.length === 0 ? (
        <div className="stf-empty">{t("staffMisc.front.dashboard.noTasksToday")}</div>
      ) : (
        tasks.slice(0, 8).map((task) => (
          <div key={task.id} className={`stf-row${task.status === "completed" ? " dn" : ""}`}>
            <input
              type="checkbox"
              checked={task.status === "completed"}
              disabled={busyId === task.id}
              aria-label={task.title}
              onChange={(event) => onToggle(task, event.target.checked)}
            />
            <span className="tt">{task.title}</span>
            {task.late && <span className="stf-tag r">{t("staffMisc.front.dashboard.late")}</span>}
            {task.priority && task.priority !== "medium" && !task.late && (
              <span className={`stf-tag ${task.priority === "critical" ? "r" : "w"}`}>{task.priority}</span>
            )}
          </div>
        ))
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="stf-btn sm" onClick={onAdd}>
          <Plus size={13} /> {t("staffMisc.front.dashboard.addTask")}
        </button>
        <button type="button" className="stf-btn sm" onClick={onOpenAll}>
          {t("staffMisc.front.dashboard.allTasks")}
        </button>
      </div>
    </div>
  );
}

/** Today's meetings and sessions, from the calendar feed. */
export function MeetingsCard({ meetings, onAdd }) {
  const { t } = useI18n();
  return (
    <div className="stf-card">
      <h3>
        <Video size={16} />
        {t("staffMisc.front.dashboard.todayMeetings")}
      </h3>
      {meetings.length === 0 ? (
        <div className="stf-empty">{t("staffMisc.front.dashboard.noMeetingsToday")}</div>
      ) : (
        meetings.slice(0, 6).map((meeting) => (
          <div key={meeting.uid} className="stf-row">
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{meeting.title}</b>
              {meeting.place && <div className="sec">{meeting.place}</div>}
            </div>
            <span className="mo">{meeting.allDay ? t("staffMisc.front.calendar.allDay") : timeLabel(meeting.start)}</span>
          </div>
        ))
      )}
      <button type="button" className="stf-btn sm" style={{ marginTop: 10 }} onClick={onAdd}>
        <Plus size={13} /> {t("staffMisc.front.dashboard.schedule")}
      </button>
    </div>
  );
}

/** This week's stand-up and retro status, and how regular the person is. */
export function WeeklyReportsCard({ week, status, regularity, loading, onOpen }) {
  const { t } = useI18n();
  const tone = { regular: "g", at_risk: "w", inactive: "r" }[regularity];
  const line = (key, label, done, tab) => (
    <button type="button" className="stf-row" style={{ width: "100%", background: "none", border: 0, textAlign: "left", borderTop: "1px solid var(--border-primary)" }} onClick={() => onOpen(tab)}>
      <span>{label}</span>
      <span style={{ marginLeft: "auto" }}>
        {loading ? <span className="stf-tag">{t("common.loading")}</span> : done ? <span className="stf-tag g">{t("status.submitted")}</span> : <span className="stf-tag o">{t("staffMisc.front.dashboard.toDo")}</span>}
      </span>
    </button>
  );
  return (
    <div className="stf-card">
      <h3>
        <Mic size={16} />
        {t("staffMisc.front.dashboard.weekReports")}
      </h3>
      <p className="stf-k" style={{ marginBottom: 6 }}>
        {t("staffMisc.front.dashboard.weekLabel", { week: week.week, year: week.year })}
      </p>
      {line("standup", t("reports.mondayStandup"), status.standup, "standup")}
      {line("retro", t("reports.fridayRetro"), status.retro, "retro")}
      <p className="stf-k" style={{ margin: "14px 0 6px" }}>{t("staffMisc.front.dashboard.regularity")}</p>
      <span className={`stf-tag ${tone}`}>{t(`staffMisc.front.regularity.${regularity}`)}</span>
      <div style={{ marginTop: 12 }}>
        <button type="button" className="stf-btn sm" onClick={() => onOpen("standup")}>
          {t("staffMisc.front.dashboard.openWeeklyOps")}
        </button>
      </div>
    </div>
  );
}

/** The person's active blockers, resolvable in place. */
export function BlockersCard({ blockers, resolvingId, onResolve, onOpenAll }) {
  const { t } = useI18n();
  return (
    <div className="stf-card">
      <h3>
        <AlertTriangle size={16} />
        {t("staffMisc.front.dashboard.blockers")}
        {blockers.length > 0 && (
          <span className="stf-tag r" style={{ marginLeft: "auto" }}>{blockers.length}</span>
        )}
      </h3>
      {blockers.length === 0 ? (
        <div className="stf-empty">
          <CheckCircle2 size={30} style={{ color: "var(--stf-done)" }} />
          {t("staffMisc.front.dashboard.noBlockers")}
        </div>
      ) : (
        blockers.slice(0, 4).map((blocker) => (
          <div key={blocker.id} className="stf-row">
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{blocker.title}</b>
              <div className="sec">
                {blocker.task_title}
                {blocker.severity ? ` · ${blocker.severity}` : ""}
              </div>
            </div>
            <button type="button" className="stf-btn sm ok" style={{ marginLeft: "auto" }} disabled={resolvingId === blocker.id} onClick={() => onResolve(blocker.id)}>
              <Check size={13} /> {resolvingId === blocker.id ? "…" : t("staffMisc.front.dashboard.resolve")}
            </button>
          </div>
        ))
      )}
      <button type="button" className="stf-btn sm" style={{ marginTop: 10 }} onClick={onOpenAll}>
        {t("staffMisc.front.dashboard.allBlockers")}
      </button>
    </div>
  );
}

/** Tasks handed to the person: accept / decline while pending, complete afterwards. */
export function AssignmentsCard({ assignments, actionId, onAction, onOpenAll }) {
  const { t, lang } = useI18n();
  const pending = assignments.filter((task) => task.status === "pending").length;
  return (
    <div className="stf-card">
      <h3>
        <Target size={16} />
        {t("dashboard.assignedToMe")}
        <span className="stf-tag w" style={{ marginLeft: "auto" }}>
          {pending} {t("dashboard.awaitingAction")}
        </span>
      </h3>
      {assignments.slice(0, 4).map((task) => {
        const isPending = task.status === "pending";
        return (
          <div key={task.id} className="stf-row" style={{ alignItems: "flex-start" }}>
            <span className="stf-av" style={{ margin: 0, width: 28, height: 28 }}>{initial(task.user_name)}</span>
            <div style={{ minWidth: 0 }}>
              <b style={{ fontSize: 13 }}>{task.title}</b>
              <div className="sec">
                {t("dashboard.assignedBy")} {task.user_name || "System"}
                {task.end_date ? ` · ${t("common.due")} ${new Date(task.end_date).toLocaleDateString(lang)}` : ""}
              </div>
            </div>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6, flex: "none" }}>
              {isPending ? (
                <>
                  <button type="button" className="stf-btn sm ok" disabled={actionId === task.id} onClick={() => onAction(task.id, "accepted")}>
                    {actionId === task.id ? "…" : t("common.accept")}
                  </button>
                  <button type="button" className="stf-btn sm rj" disabled={actionId === task.id} onClick={() => onAction(task.id, "declined")}>
                    {t("common.decline")}
                  </button>
                </>
              ) : (
                <button type="button" className="stf-btn sm" disabled={actionId === task.id} onClick={() => onAction(task.id, "completed_assignment")}>
                  {actionId === task.id ? "…" : t("common.complete")}
                </button>
              )}
            </span>
          </div>
        );
      })}
      {assignments.length > 4 && (
        <button type="button" className="stf-link-btn" style={{ marginTop: 8 }} onClick={onOpenAll}>
          {t("common.viewAll")} ({assignments.length})
        </button>
      )}
    </div>
  );
}

/** The projects the person owns or collaborates on. */
export function ProjectsCard({ projects, onOpen, onOpenAll }) {
  const { t } = useI18n();
  return (
    <div className="stf-card">
      <h3>
        <FolderKanban size={16} />
        {t("staffMisc.front.dashboard.myProjects")}
      </h3>
      {projects.length === 0 ? (
        <div className="stf-empty">{t("staffMisc.front.dashboard.noProjects")}</div>
      ) : (
        projects.slice(0, 5).map((project) => {
          const total = Number(project.task_total) || 0;
          const finished = Number(project.task_completed) || 0;
          const progress = total ? Math.round((finished / total) * 100) : 0;
          return (
            <button key={project.id} type="button" className="stf-pg" onClick={() => onOpen(project)}>
              <span style={{ minWidth: 0 }}>
                <b>{project.name}</b>
                <span className="stf-small">
                  {total ? t("staffMisc.front.dashboard.projectProgress", { done: finished, total }) : t("staffMisc.front.dashboard.noTasksYet")}
                  {project.blocker_active > 0 ? ` · ${t("staffMisc.front.dashboard.blockersCount", { count: project.blocker_active })}` : ""}
                </span>
                <span className="stf-bar-prog" style={{ display: "block" }}><i style={{ width: `${progress}%` }} /></span>
              </span>
              <ChevronRight size={14} className="ch" />
            </button>
          );
        })
      )}
      <button type="button" className="stf-btn sm" style={{ marginTop: 6 }} onClick={onOpenAll}>
        {t("staffMisc.front.dashboard.allProjects")}
      </button>
    </div>
  );
}

// ─── Sections A–D ────────────────────────────────────────────────────────────

const ACTIVITY_KEYS = {
  task_completed: "staffMisc.front.activity.task_completed",
  blocker_resolved: "staffMisc.front.activity.blocker_resolved",
  task_assigned: "staffMisc.front.activity.task_assigned",
  assigned: "staffMisc.front.activity.assigned",
};

/** A — recent activity and the programmes the person works on. */
export function ProgramsSection({ activity, programs, onOpenProgram, onOpenAll }) {
  const { t, lang } = useI18n();
  return (
    <section className="stf-sec">
      <SectionHead
        letter="A"
        tone="o"
        icon={FolderKanban}
        title={t("staffMisc.front.sectionA.title")}
        subtitle={t("staffMisc.front.sectionA.subtitle")}
        action={{ label: t("staffMisc.front.sectionA.all"), onClick: onOpenAll }}
      />
      <div className="stf-grid c2">
        <div className="stf-card">
          <h3>
            <Clock size={15} />
            {t("staffMisc.front.sectionA.recent")}
          </h3>
          {activity.length === 0 ? (
            <div className="stf-empty">{t("staffMisc.front.sectionA.noActivity")}</div>
          ) : (
            activity.slice(0, 6).map((entry, index) => (
              <div key={`${entry.action}-${entry.timestamp}-${index}`} className="stf-row">
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{ACTIVITY_KEYS[entry.action] ? t(ACTIVITY_KEYS[entry.action]) : String(entry.action || "").replace(/_/g, " ")}</b>
                  <div className="sec">{entry.description}</div>
                </div>
                <span className="mo">{entry.timestamp ? new Date(entry.timestamp).toLocaleDateString(lang) : ""}</span>
              </div>
            ))
          )}
        </div>
        <div className="stf-card">
          <h3>
            <FolderKanban size={15} />
            {t("staffMisc.front.sectionA.active")}
          </h3>
          {programs.length === 0 ? (
            <div className="stf-empty">{t("staffMisc.front.sectionA.noPrograms")}</div>
          ) : (
            programs.slice(0, 5).map((program) => (
              <button key={program.id} type="button" className="stf-pg" onClick={() => onOpenProgram(program)}>
                <span style={{ minWidth: 0 }}>
                  <b>{String(program.name || "").toUpperCase()}</b>
                  {program.status && <span className="stf-small"><span className="stf-tag g">{String(program.status).toUpperCase()}</span></span>}
                </span>
                <ChevronRight size={14} className="ch" />
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/** B — the person's own operational numbers, and the doors to the work. */
export function OperationsSection({ totals, summary, onGo }) {
  const { t } = useI18n();
  const stat = (label, value, hint) => (
    <KpiCard label={label} value={value} hint={hint} icon={RefreshCw} />
  );

  const link = (title, text, route, tone, tag) => (
    <LinkCard title={title} text={text} tone={tone || ""} tag={tag} onClick={() => onGo(route)} />
  );
  const active = summary?.blockers?.active || 0;
  return (
    <section className="stf-sec">
      <SectionHead
        letter="B"
        tone="b"
        icon={CalendarClock}
        title={t("staffMisc.front.sectionB.title")}
        subtitle={t("staffMisc.front.sectionB.subtitle")}
        action={{ label: t("staffMisc.front.sectionB.all"), onClick: () => onGo("/staff/op-report") }}
      />
      <div className="stf-grid c4">
        {stat(t("reports.mondayStandup"), totals.standups, t("staffMisc.front.sectionB.submitted"))}
        {stat(t("reports.fridayRetro"), totals.retros, "", "g")}
        {stat(t("staffMisc.front.sectionB.blockersReported"), totals.blockers, "", "r")}
        {stat(t("staffMisc.front.sectionB.blockerRate"), `${totals.blockerRate}%`, t("staffMisc.front.sectionB.ofStandups"), "r")}
      </div>
      <div className="stf-grid g3">
        {link(t("staffMisc.front.sectionB.myTasks"), t("staffMisc.front.sectionB.myTasksText"), "/staff/tasks", "b")}
        {link(t("staffMisc.front.sectionB.myProjects"), t("staffMisc.front.sectionB.myProjectsText"), "/staff/projects")}
        {link(
          t("staffMisc.front.sectionB.blockers"),
          t("staffMisc.front.sectionB.blockersText"),
          "/staff/op-report?tab=summary",
          "",
          active ? <span className="stf-tag r">{t("staffMisc.front.sectionB.activeCount", { count: active })}</span> : <span className="stf-tag g">{t("staffMisc.front.dashboard.noBlockers")}</span>,
        )}
      </div>
    </section>
  );
}

/** C — how regular the person's weekly reporting has been, week by week. */
export function RegularitySection({ record, regularity, open, onToggle }) {
  const { t } = useI18n();
  const tone = { regular: "g", at_risk: "o", inactive: "r" }[regularity];
  return (
    <section className="stf-sec">
      <SectionHead
        letter="C"
        tone="g"
        icon={CheckCircle2}
        title={t("staffMisc.front.sectionC.title")}
        subtitle={t("staffMisc.front.sectionC.subtitle")}
        action={{ label: open ? t("staffMisc.front.sectionC.collapse") : t("staffMisc.front.sectionC.expand"), onClick: onToggle }}
      />
      <div className="stf-grid g3">
        <StatusCard
          tone={tone}
          icon={regularity === "regular" ? Check : regularity === "at_risk" ? Clock : AlertTriangle}
          label={t("staffMisc.front.sectionC.currentStatus")}
          value={t(`staffMisc.front.regularity.${regularity}`)}
        />
      </div>
      {open && (
        <div className="stf-tw d2t">
          <table>
            <thead>
              <tr>
                <th>{t("staffMisc.front.sectionC.week")}</th>
                <th className="c">{t("reports.mondayStandup")}</th>
                <th className="c">{t("reports.fridayRetro")}</th>
                <th className="c">{t("staffMisc.front.sectionC.blockers")}</th>
              </tr>
            </thead>
            <tbody>
              {record.map((week, index) => {
                const current = index === record.length - 1;
                return (
                  <tr key={`${week.year}-${week.week}`}>
                    <td><b style={{ fontSize: 12 }}>{t("staffMisc.front.dashboard.weekLabel", { week: week.week, year: week.year })}</b></td>
                    <td className="c">{week.standup ? <span className="stf-tag g">{t("status.submitted")}</span> : <span className={`stf-tag ${current ? "o" : "r"}`}>{current ? t("staffMisc.front.dashboard.toDo") : t("staffMisc.front.sectionC.missing")}</span>}</td>
                    <td className="c">{week.retro ? <span className="stf-tag g">{t("status.submitted")}</span> : <span className={`stf-tag ${current ? "" : "r"}`}>{current ? t("staffMisc.front.sectionC.upcoming") : t("staffMisc.front.sectionC.missing")}</span>}</td>
                    <td className="c">{week.blockers}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** D — shortcuts to the history and the other staff pages. */
export function ShortcutsSection({ onGo }) {
  const { t } = useI18n();
  const link = (title, text, route, tone) => (
    <LinkCard title={title} text={text} tone={tone || ""} onClick={() => onGo(route)} />
  );
  return (
    <section className="stf-sec">
      <SectionHead
        letter="D"
        tone="o"
        icon={Clock}
        title={t("staffMisc.front.sectionD.title")}
        subtitle={t("staffMisc.front.sectionD.subtitle")}
        action={{ label: t("staffMisc.front.sectionD.archive"), onClick: () => onGo("/staff/op-report?tab=summary") }}
      />
      <div className="stf-grid c5">
        {link(t("staffMisc.front.sectionD.projects"), t("staffMisc.front.sectionD.projectsText"), "/staff/projects", "g")}
        {link(t("staffMisc.front.sectionD.history"), t("staffMisc.front.sectionD.historyText"), "/staff/op-report?tab=summary", "b")}
        {link(t("staffMisc.front.sectionD.tasks"), t("staffMisc.front.sectionD.tasksText"), "/staff/tasks", "b")}
        {link(t("staffMisc.front.sectionD.forms"), t("staffMisc.front.sectionD.formsText"), "/platform", "b")}
        {link(t("staffMisc.front.sectionD.messages"), t("staffMisc.front.sectionD.messagesText"), "/staff/messages")}
      </div>
    </section>
  );
}
