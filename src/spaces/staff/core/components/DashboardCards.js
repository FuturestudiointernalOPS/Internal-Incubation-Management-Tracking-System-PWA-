"use client";

import { useState } from "react";
import { ChevronDown, Check, CheckCircle2, Plus, CalendarDays, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import SectionHead from "@/components/ui/SectionHead";
import LinkCard from "@/components/ui/LinkCard";
import { addDays, dateKey, itemsOnDay, timeLabel, weekStart } from "@/components/shared/calendar/calendarModel";

const initial = (name) => String(name || "?").trim().charAt(0).toUpperCase() || "?";
/** Each fold shows at most this many rows; the rest sit behind "See all". */
const PREVIEW = 2;

/**
 * A folded block (closed on arrival). The header always shows what is inside
 * (a count) so a closed fold still tells the person whether it needs them.
 */
function Fold({ title, count, tone = "", children }) {
  return (
    <details className="stf-fold">
      <summary>
        <span>{title}</span>
        <span className={`stf-tag ${tone}`}>{count}</span>
        <ChevronDown size={15} className="stf-fold-chev" aria-hidden="true" />
      </summary>
      <div className="stf-fold-body">{children}</div>
    </details>
  );
}

/** Renders the first rows of a list, and the rest behind a "See all (n)" toggle. */
function Limited({ rows }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW);
  return (
    <>
      {shown}
      {rows.length > PREVIEW && (
        <button type="button" className="stf-link-btn" onClick={() => setAll(!all)}>
          {all ? t("staffMisc.front.dashboard.showLess") : t("staffMisc.front.dashboard.seeAll", { count: rows.length })}
        </button>
      )}
    </>
  );
}

/**
 * THIS WEEK — the seven days of the current week, a dot on the busy ones, and
 * the door to the calendar. Choosing a day opens the calendar on that day.
 */
export function WeekCard({ now, items, week, onOpenCalendar }) {
  const { t, lang } = useI18n();
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const todayKey = dateKey(now);
  const first = weekStart(now);
  const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));
  return (
    <div className="stf-card">
      <h3>
        <CalendarDays size={16} />
        {t("staffMisc.front.dashboard.thisWeek")}
        <span className="stf-tag b" style={{ marginLeft: "auto" }}>
          {t("staffMisc.front.dashboard.weekShort", { week })}
        </span>
      </h3>
      <div className="stf-week">
        {days.map((day) => {
          const key = dateKey(day);
          const busy = itemsOnDay(items, key).length > 0;
          return (
            <button
              key={key}
              type="button"
              className={`stf-wday${key === todayKey ? " today" : ""}`}
              aria-label={day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => onOpenCalendar(key)}
            >
              <span>{day.toLocaleDateString(locale, { weekday: "short" })}</span>
              <b>{day.getDate()}</b>
              <i className={busy ? "dot" : "dot off"} />
            </button>
          );
        })}
      </div>
      <button type="button" className="stf-btn" style={{ marginTop: 14 }} onClick={() => onOpenCalendar(todayKey)}>
        {t("staffMisc.front.dashboard.openCalendar")}
      </button>
    </div>
  );
}

/**
 * NEEDS YOU TODAY — today's tasks, blockers, meetings (and tasks handed to the
 * person, when there are any), each in its own closed fold showing at most two rows.
 */
export function NeedsYouCard({
  tasks,
  blockers,
  meetings,
  assignments,
  busyTask,
  resolvingId,
  actionId,
  onToggleTask,
  onAddTask,
  onAddMeeting,
  onResolve,
  onAssignmentAction,
  onOpenTasks,
  onOpenBlockers,
}) {
  const { t, lang } = useI18n();
  const late = tasks.filter((task) => task.status !== "completed" && task.late).length;
  const open = tasks.filter((task) => task.status !== "completed").length;
  const waiting = assignments.filter((task) => task.status === "pending").length;

  const taskRows = tasks.map((task) => (
    <div key={task.id} className={`stf-row${task.status === "completed" ? " dn" : ""}`}>
      <input
        type="checkbox"
        checked={task.status === "completed"}
        disabled={busyTask === task.id}
        aria-label={task.title}
        onChange={(event) => onToggleTask(task, event.target.checked)}
      />
      <span className="tt">{task.title}</span>
      {task.late && <span className="stf-tag r">{t("staffMisc.front.dashboard.late")}</span>}
      {task.priority && task.priority !== "medium" && !task.late && (
        <span className={`stf-tag ${task.priority === "critical" ? "r" : "w"}`}>{task.priority}</span>
      )}
    </div>
  ));

  const blockerRows = blockers.map((blocker) => (
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
  ));

  const meetingRows = meetings.map((meeting) => (
    <div key={meeting.uid} className="stf-row">
      <div style={{ minWidth: 0 }}>
        <b style={{ fontSize: 13 }}>{meeting.title}</b>
        {meeting.place && <div className="sec">{meeting.place}</div>}
      </div>
      <span className="mo">{meeting.allDay ? t("staffMisc.front.calendar.allDay") : timeLabel(meeting.start)}</span>
    </div>
  ));

  const assignmentRows = assignments.map((task) => {
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
              <button type="button" className="stf-btn sm ok" disabled={actionId === task.id} onClick={() => onAssignmentAction(task.id, "accepted")}>
                {actionId === task.id ? "…" : t("common.accept")}
              </button>
              <button type="button" className="stf-btn sm rj" disabled={actionId === task.id} onClick={() => onAssignmentAction(task.id, "declined")}>
                {t("common.decline")}
              </button>
            </>
          ) : (
            <button type="button" className="stf-btn sm" disabled={actionId === task.id} onClick={() => onAssignmentAction(task.id, "completed_assignment")}>
              {actionId === task.id ? "…" : t("common.complete")}
            </button>
          )}
        </span>
      </div>
    );
  });

  return (
    <div className="stf-card">
      <h3>
        <CheckCircle2 size={16} />
        {t("staffMisc.front.dashboard.needsYou")}
        <span className={`stf-tag ${late ? "r" : open ? "o" : "g"}`} style={{ marginLeft: "auto" }}>
          {late ? t("staffMisc.front.dashboard.lateCount", { count: late }) : open ? t("staffMisc.front.dashboard.openCount", { count: open }) : t("staffMisc.front.dashboard.allDone")}
        </span>
      </h3>

      <Fold title={t("staffMisc.front.dashboard.todayTasks")} count={tasks.length} tone={late ? "r" : "b"}>
        {tasks.length === 0 ? <div className="stf-empty-line">{t("staffMisc.front.dashboard.noTasksToday")}</div> : <Limited rows={taskRows} />}
        <div className="stf-fold-actions">
          <button type="button" className="stf-btn sm" onClick={onAddTask}>
            <Plus size={13} /> {t("staffMisc.front.dashboard.addTask")}
          </button>
          <button type="button" className="stf-btn sm" onClick={onOpenTasks}>
            {t("staffMisc.front.dashboard.allTasks")}
          </button>
        </div>
      </Fold>

      <Fold title={t("staffMisc.front.dashboard.blockers")} count={blockers.length} tone={blockers.length ? "w" : "g"}>
        {blockers.length === 0 ? <div className="stf-empty-line">{t("staffMisc.front.dashboard.noBlockers")}</div> : <Limited rows={blockerRows} />}
        <div className="stf-fold-actions">
          <button type="button" className="stf-btn sm" onClick={onOpenBlockers}>
            {t("staffMisc.front.dashboard.allBlockers")}
          </button>
        </div>
      </Fold>

      <Fold title={t("staffMisc.front.dashboard.todayMeetings")} count={meetings.length} tone="b">
        {meetings.length === 0 ? <div className="stf-empty-line">{t("staffMisc.front.dashboard.noMeetingsToday")}</div> : <Limited rows={meetingRows} />}
        <div className="stf-fold-actions">
          <button type="button" className="stf-btn sm" onClick={onAddMeeting}>
            <Plus size={13} /> {t("staffMisc.front.dashboard.schedule")}
          </button>
        </div>
      </Fold>

      {assignments.length > 0 && (
        <Fold title={t("dashboard.assignedToMe")} count={waiting ? `${waiting} ${t("dashboard.awaitingAction")}` : assignments.length} tone="w">
          <Limited rows={assignmentRows} />
        </Fold>
      )}
    </div>
  );
}

const ACTIVITY_KEYS = {
  task_completed: "staffMisc.front.activity.task_completed",
  blocker_resolved: "staffMisc.front.activity.blocker_resolved",
  task_assigned: "staffMisc.front.activity.task_assigned",
  assigned: "staffMisc.front.activity.assigned",
};

/** Recent activity and the week-by-week report record, folded away until asked for. */
export function HistoryFold({ activity, record }) {
  const { t, lang } = useI18n();
  return (
    <div className="stf-card">
      <details className="stf-fold nb">
        <summary>
          <span className="stf-fold-title">
            <Clock size={15} />
            {t("staffMisc.front.dashboard.historyTitle")}
          </span>
          <ChevronDown size={15} className="stf-fold-chev" aria-hidden="true" />
        </summary>
        <div className="stf-fold-body">
          <p className="stf-k" style={{ margin: "4px 0 6px" }}>{t("staffMisc.front.sectionA.recent")}</p>
          {activity.length === 0 ? (
            <div className="stf-empty-line">{t("staffMisc.front.sectionA.noActivity")}</div>
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
          <p className="stf-k" style={{ margin: "16px 0 6px" }}>{t("staffMisc.front.dashboard.reportHistory")}</p>
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
        </div>
      </details>
    </div>
  );
}

/** History & shortcuts — three doors: forms, messages, Weekly Ops. */
export function ShortcutsSection({ onGo }) {
  const { t } = useI18n();
  const link = (title, text, route, tone) => <LinkCard title={title} text={text} tone={tone || ""} onClick={() => onGo(route)} />;
  return (
    <section className="stf-sec">
      <SectionHead
        letter=""
        tone="o"
        icon={Clock}
        title={t("staffMisc.front.sectionD.title")}
        subtitle={t("staffMisc.front.sectionD.subtitleShort")}
        action={{ label: t("staffMisc.front.sectionD.archive"), onClick: () => onGo("/staff/op-report?tab=summary") }}
      />
      <div className="stf-grid c3">
        {link(t("staffMisc.front.sectionD.forms"), t("staffMisc.front.sectionD.formsText"), "/admin/communication/forms", "b")}
        {link(t("staffMisc.front.sectionD.messages"), t("staffMisc.front.sectionD.messagesText"), "/staff/messages")}
        {link(t("staffMisc.front.sectionD.weeklyOps"), t("staffMisc.front.sectionD.weeklyOpsText"), "/staff/op-report?tab=standup", "b")}
      </div>
    </section>
  );
}
