import { useI18n } from "@/lib/i18n";
import {
  Activity,
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Plus,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import CoachingRequestsPanel from "@/components/lms/CoachingRequestsPanel";
import ProgramLearningSection from "@/components/lms/ProgramLearningSection";

export default function CurriculumTab({
  assignedStaff,
  canContribute,
  canEdit,
  expandedSessionId,
  id,
  kpis,
  onAddSession,
  onDeleteSession,
  onEditSessionDescription,
  onExpandedSessionId,
  onOpenRequirementForSession,
  onOpenSessionAttendance,
  onOpenSessionPMReport,
  onSendRequirementReminder,
  onShowArchivedSessions,
  onToggleSessionExpanded,
  onToggleSessionHandler,
  onToggleSessionLock,
  onUpdateSessionFieldBlur,
  onUpdateSessionFieldChange,
  onUpdateSessionFieldEndDateChange,
  onUpdateSessionFieldEndTimeChange,
  onUpdateSessionFieldScheduledDateChange,
  onUpdateSessionFieldStartTimeChange,
  onUpdateSessionFieldTimezoneChange,
  onUpdateSessionFieldWeekNumberChange,
  onUpdateSessionStatusChange,
  programTeamMembers,
  requirements,
  sessions,
  showArchivedSessions,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4 pb-6 border-b border-[var(--border-primary)]">
        <h3 className="text-xl font-black uppercase tracking-tighter">
          {t("pmMisc.workspace.curriculumTitle")}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShowArchivedSessions((prev) => !prev)}
            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${
              showArchivedSessions
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-transparent border-white/10 text-slate-600 hover:text-slate-400"
            }`}
          >
            {showArchivedSessions
              ? t("pmMisc.workspace.showingArchived")
              : t("pmMisc.workspace.archived")}
          </button>
          {canEdit && (
            <button
              onClick={onAddSession}
              className="btn btn-primary btn-sm gap-2"
            >
              <Plus className="w-4 h-4" /> {t("pmMisc.workspace.create")}
            </button>
          )}
        </div>
      </div>
      {/* Phase 8 — learner coaching requests raised from the LMS view */}
      <CoachingRequestsPanel programId={id} canEdit={canEdit} />

      <div className="flex flex-col gap-4 mt-4">
        {(sessions || [])
          .filter(
            (session) => showArchivedSessions || session.status !== "archived",
          )
          .map((session) => (
            <div
              key={session.id}
              className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-brand-orange/50 transition-all shadow-xl bg-secondary group"
            >
              {/* STEP 0: THE HEADER (GLOBAL STATE) — click to toggle */}
              <div
                onClick={() =>
                  onExpandedSessionId(
                    expandedSessionId === session.id ? null : session.id,
                  )
                }
                className="px-6 py-4 bg-gradient-to-r from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-primary)] hover:border-brand-orange/50 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-primary border border-[var(--border-primary)] shadow-inner">
                    <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-50">
                      {t("pmMisc.workspace.weekAbbr")}
                    </span>
                    <span className="text-sm font-black text-[var(--brand-orange)] -mt-1">
                      {session.week_number}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-base font-black text-[var(--text-primary)] uppercase tracking-tight">
                      {session.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const now = new Date();
                        const today = new Date(
                          now.getFullYear(),
                          now.getMonth(),
                          now.getDate(),
                        );
                        let displayStatus = session.status;
                        let statusColor = "bg-amber-500";
                        if (session.status === "locked") {
                          displayStatus = "locked";
                          statusColor = "bg-rose-500";
                        } else if (session.scheduled_date) {
                          const scheduledDate = new Date(
                            session.scheduled_date,
                          );
                          const scheduledDay = new Date(
                            scheduledDate.getFullYear(),
                            scheduledDate.getMonth(),
                            scheduledDate.getDate(),
                          );
                          if (session.status === "completed") {
                            displayStatus = "completed";
                            statusColor = "bg-emerald-500";
                          } else if (
                            scheduledDay <= today &&
                            session.status !== "not started"
                          ) {
                            displayStatus = "active";
                            statusColor = "bg-indigo-500";
                          } else if (session.status === "not started") {
                            displayStatus = "not started";
                            statusColor = "bg-slate-500";
                          } else {
                            displayStatus = "pending";
                            statusColor = "bg-amber-500";
                          }
                        } else {
                          if (session.status === "completed") {
                            displayStatus = "completed";
                            statusColor = "bg-emerald-500";
                          } else if (
                            session.status === "in progress" ||
                            session.status === "active"
                          ) {
                            displayStatus = "active";
                            statusColor = "bg-indigo-500";
                          } else {
                            displayStatus = "pending";
                            statusColor = "bg-amber-500";
                          }
                        }
                        return (
                          <>
                            <span
                              className={`w-2 h-2 rounded-full animate-pulse ${statusColor}`}
                            />
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                              {t("pmMisc.workspace.state")}:{" "}
                              {{
                                locked: t(
                                  "pmMisc.workspace.sessionStatusLocked",
                                ),
                                completed: t(
                                  "pmMisc.workspace.sessionStatusCompleted",
                                ),
                                active: t(
                                  "pmMisc.workspace.sessionStatusActive",
                                ),
                                "not started": t(
                                  "pmMisc.workspace.sessionStatusNotStarted",
                                ),
                                pending: t(
                                  "pmMisc.workspace.sessionStatusPending",
                                ),
                              }[displayStatus] || displayStatus}
                            </span>
                          </>
                        );
                      })()}
                      {session.scheduled_date && (
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-2">
                          📅{" "}
                          {new Date(
                            session.scheduled_date,
                          ).toLocaleDateString()}
                        </span>
                      )}
                      {session.timezone && session.timezone !== "UTC" && (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                          {session.timezone}
                        </span>
                      )}
                      {session.notes && (
                        <span
                          className="text-[10px] font-bold text-amber-400 uppercase tracking-widest ml-2"
                          title={session.notes}
                        >
                          📌 {t("pmMisc.workspace.notes")}
                        </span>
                      )}
                    </div>
                    {session.handler_name && (
                      <div className="flex items-center gap-1 mt-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          {session.handler_name}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(() => {
                        try {
                          const ids =
                            typeof session.kpi_ids === "string"
                              ? JSON.parse(session.kpi_ids)
                              : session.kpi_ids || [];
                          return kpis
                            .filter((kpi) => ids.includes(kpi.id))
                            .map((kpi) => (
                              <span
                                key={kpi.id}
                                className="px-2 py-0.5 bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] text-[10px] font-bold uppercase rounded-md"
                              >
                                {kpi.title}
                              </span>
                            ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleSessionExpanded(session)}
                    title={t("pmMisc.workspace.sessionDetailsTitle")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${expandedSessionId === session.id ? "bg-brand-orange/10 border-[var(--brand-orange)] text-[var(--brand-orange)]" : "bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-brand-orange/50 hover:text-[var(--text-primary)]"}`}
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${expandedSessionId === session.id ? "rotate-90" : ""}`}
                    />
                    {expandedSessionId === session.id
                      ? t("pmMisc.workspace.hideDetails")
                      : t("pmMisc.workspace.viewDetails")}
                  </button>
                </div>

                <div
                  className="flex items-center gap-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    onClick={() => onOpenSessionAttendance(session)}
                    className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 transition-all"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {t("pmMisc.workspace.attendance")}
                    </span>
                  </button>
                  {canContribute && (
                    <button
                      onClick={() => onOpenSessionPMReport(session)}
                      className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {t("pmMisc.workspace.giveWeeklyReport")}
                      </span>
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => onToggleSessionLock(session)}
                      title={
                        session.status === "locked"
                          ? t("pmMisc.workspace.unlockWeek")
                          : t("pmMisc.workspace.lockWeek")
                      }
                      className={`btn btn-secondary !py-2 !px-4 flex items-center gap-2 transition-all ${
                        session.status === "locked"
                          ? "border-rose-500/20 text-rose-500 hover:bg-rose-500/5"
                          : "border-amber-500/20 text-amber-500 hover:bg-amber-500/5"
                      }`}
                    >
                      <span className="text-sm">
                        {session.status === "locked" ? "🔓" : "🔒"}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {session.status === "locked"
                          ? t("pmMisc.workspace.unlock")
                          : t("pmMisc.workspace.lock")}
                      </span>
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => onDeleteSession(session)}
                      className="p-2 text-rose-500/20 hover:text-rose-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`p-6 ${expandedSessionId !== session.id ? "hidden" : ""}`}
              >
                <div className="space-y-8">
                  {/* PHASE 1: LOGISTICS (THE SETUP) */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-3 border-b border-indigo-500/20">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center text-[10px] font-bold text-indigo-500 border border-indigo-500/20 shadow-sm">
                        1
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                        {t("pmMisc.workspace.curriculumLogistics")}
                      </span>
                    </div>

                    <div
                      className={`space-y-4 p-5 bg-primary rounded-2xl border border-[var(--border-primary)] shadow-sm ${!canEdit ? "pointer-events-none opacity-60" : ""}`}
                    >
                      {/* Session Title */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                          {t("pmMisc.workspace.sessionTitle")}
                        </label>
                        <input
                          type="text"
                          value={session.title || ""}
                          onChange={(event) =>
                            onUpdateSessionFieldChange(
                              session.id,
                              "title",
                              event.target.value,
                            )
                          }
                          disabled={session.status === "locked"}
                          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                          {t("pmMisc.workspace.description")}
                        </label>
                        <textarea
                          value={session.description || ""}
                          onBlur={(event) =>
                            onUpdateSessionFieldBlur(
                              session.id,
                              "description",
                              event.target.value,
                            )
                          }
                          onChange={() => onEditSessionDescription(session)}
                          rows={2}
                          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[11px] font-bold outline-none focus:border-indigo-500 transition-all resize-none"
                        />
                      </div>

                      {/* Week Number + Start/End Time */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                            {t("pmMisc.workspace.week")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={session.week_number || 1}
                            onChange={(event) =>
                              onUpdateSessionFieldWeekNumberChange(
                                session.id,
                                "week_number",
                                event.target.value,
                              )
                            }
                            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{" "}
                            {t("pmMisc.workspace.startTime")}
                          </label>
                          <input
                            type="time"
                            value={session.start_time || ""}
                            onChange={(event) =>
                              onUpdateSessionFieldStartTimeChange(
                                session.id,
                                "start_time",
                                event.target.value,
                              )
                            }
                            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{" "}
                            {t("pmMisc.workspace.endTime")}
                          </label>
                          <input
                            type="time"
                            value={session.end_time || ""}
                            onChange={(event) =>
                              onUpdateSessionFieldEndTimeChange(
                                session.id,
                                "end_time",
                                event.target.value,
                              )
                            }
                            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Timezone */}
                      <div className="space-y-1 mt-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                          {t("pmMisc.workspace.timezone")}
                        </label>
                        <select
                          value={
                            session.timezone ||
                            (typeof Intl !== "undefined"
                              ? Intl.DateTimeFormat().resolvedOptions().timeZone
                              : "UTC")
                          }
                          onChange={(event) =>
                            onUpdateSessionFieldTimezoneChange(
                              session.id,
                              "timezone",
                              event.target.value,
                            )
                          }
                          className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                        >
                          {[
                            "UTC",
                            "Africa/Porto-Novo",
                            "Europe/Paris",
                            "America/New_York",
                            "Asia/Dubai",
                            "Europe/London",
                          ].map((timezone) => (
                            <option key={timezone} value={timezone}>
                              {timezone}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                          {t("pmMisc.workspace.assignStaffMembers")}
                        </label>
                        <div className="space-y-2 p-3 bg-tertiary border border-[var(--border-primary)] rounded-xl max-h-40 overflow-y-auto custom-scrollbar">
                          {(programTeamMembers.length > 0
                            ? programTeamMembers
                            : assignedStaff
                          ).map((staffMember) => {
                            const stringId = String(staffMember.cid);
                            let isSelected = false;
                            try {
                              const ids = JSON.parse(
                                session.handler_id || "[]",
                              );
                              isSelected = Array.isArray(ids)
                                ? ids.includes(stringId)
                                : session.handler_id === stringId;
                            } catch {
                              isSelected = session.handler_id === stringId;
                            }
                            return (
                              <label
                                key={staffMember.cid}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    onToggleSessionHandler(session, stringId)
                                  }
                                  className="rounded border-[var(--border-primary)] bg-[var(--surface-2)] text-indigo-500"
                                />
                                <span className="text-[11px] font-bold text-[var(--text-primary)]">
                                  {staffMember.name} ({staffMember.role})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                            {t("pmMisc.workspace.startDate")}
                          </label>
                          <input
                            type="date"
                            value={
                              session.scheduled_date
                                ? new Date(session.scheduled_date)
                                    .toISOString()
                                    .split("T")[0]
                                : ""
                            }
                            onChange={(event) =>
                              onUpdateSessionFieldScheduledDateChange(
                                session.id,
                                "scheduled_date",
                                event.target.value,
                              )
                            }
                            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5 text-white" />{" "}
                            {t("pmMisc.workspace.finishDate")}
                          </label>
                          <input
                            type="date"
                            value={
                              session.end_date
                                ? new Date(session.end_date)
                                    .toISOString()
                                    .split("T")[0]
                                : ""
                            }
                            onChange={(event) =>
                              onUpdateSessionFieldEndDateChange(
                                session.id,
                                "end_date",
                                event.target.value,
                              )
                            }
                            className="w-full bg-tertiary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-50 ml-1">
                          {t("pmMisc.workspace.operationalState")}
                        </label>
                        <select
                          value={session.status}
                          onChange={(event) =>
                            onUpdateSessionStatusChange(
                              session.id,
                              event.target.value,
                            )
                          }
                          disabled={session.status === "locked"}
                          className={`w-full mt-1 px-4 py-3 rounded-xl border text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${
                            session.status === "locked"
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                              : session.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                                : session.status === "in progress"
                                  ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
                                  : session.status === "not started"
                                    ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
                                    : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          }`}
                        >
                          <option value="not started">
                            {t("pmMisc.workspace.sessionStatusNotStarted")}
                          </option>
                          <option value="pending">
                            {t("pmMisc.workspace.sessionStatusPending")}
                          </option>
                          <option value="in progress">
                            {t("pmMisc.workspace.sessionStatusInProgress")}
                          </option>
                          <option value="completed">
                            {t("pmMisc.workspace.sessionStatusCompleted")}
                          </option>
                          <option value="locked">
                            {t("pmMisc.workspace.sessionStatusLockedOption")}
                          </option>
                        </select>
                      </div>
                      {session.version > 1 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                            {t("pmMisc.workspace.version")}: {session.version}
                          </span>
                          <span className="text-[7px] text-slate-500">
                            ({session.version - 1}{" "}
                            {t(
                              session.version > 2
                                ? "pmMisc.workspace.revisions"
                                : "pmMisc.workspace.revision",
                            )}
                            )
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SEPARATOR */}
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

                  {/* PHASE 2: CURRICULUM (THE CORE) */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-3 border-b border-brand-orange/20">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center text-[9px] font-black text-[var(--brand-orange)] border border-brand-orange/20 shadow-sm">
                          2
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
                          {t("pmMisc.workspace.curriculumAssessments")}
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => onOpenRequirementForSession(session)}
                          className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />{" "}
                          {t("pmMisc.workspace.addRequirement")}
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                      {requirements
                        .filter(
                          (requirement) =>
                            requirement.session_id === session.id,
                        )
                        .map((requirement) => (
                          <div
                            key={requirement.id}
                            className="flex items-center justify-between p-4 bg-primary rounded-2xl border border-[var(--border-primary)] hover:border-brand-orange/30 transition-all shadow-sm"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded-xl bg-indigo-500/5 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-indigo-500" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                                  {requirement.title}
                                </p>
                                <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5 italic flex items-center gap-2">
                                  <span>
                                    {t("pmMisc.workspace.requirement")}:{" "}
                                    {requirement.allowed_format || "PDF"}
                                  </span>
                                  {requirement.due_date &&
                                    (() => {
                                      const now = new Date();
                                      const due = new Date(
                                        requirement.due_date,
                                      );
                                      const diffDays = Math.ceil(
                                        (due - now) / (1000 * 60 * 60 * 24),
                                      );
                                      const isOverdue = diffDays < 0;
                                      const isDueSoon =
                                        diffDays >= 0 && diffDays <= 3;
                                      return (
                                        <>
                                          <span>•</span>
                                          <span
                                            className={
                                              isOverdue
                                                ? "text-rose-500"
                                                : isDueSoon
                                                  ? "text-amber-500"
                                                  : "text-amber-500/60"
                                            }
                                          >
                                            {t("pmMisc.workspace.due")}:{" "}
                                            {due.toLocaleDateString()}
                                          </span>
                                          {isOverdue && (
                                            <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-rose-500/20 text-rose-400">
                                              {t("pmMisc.workspace.overdue")}
                                            </span>
                                          )}
                                          {isDueSoon && (
                                            <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/20 text-amber-400">
                                              {t("pmMisc.workspace.dueSoon")}
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {requirement.due_date && canEdit && (
                                <button
                                  onClick={() =>
                                    onSendRequirementReminder(requirement)
                                  }
                                  className="text-[7px] font-black uppercase text-brand-orange/60 hover:text-[var(--brand-orange)] transition-all px-2 py-1 rounded border border-brand-orange/20 hover:border-brand-orange/50"
                                  title={t(
                                    "pmMisc.workspace.sendReminderTitle",
                                  )}
                                >
                                  <Bell className="w-3 h-3 inline mr-1" />
                                  {t("pmMisc.workspace.remind")}
                                </button>
                              )}
                              {canEdit && (
                                <button className="text-rose-500/10 hover:text-rose-500 transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      {requirements.filter(
                        (requirement) => requirement.session_id === session.id,
                      ).length === 0 && (
                        <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
                          <Shield className="w-10 h-10 mb-2" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">
                            {t("pmMisc.workspace.noRequirementsSet")}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-[8px] font-bold text-slate-500/50 uppercase tracking-widest italic text-center px-6">
                      {t("pmMisc.workspace.curriculumEvidenceNote")}
                    </p>
                  </div>

                  {/* SEPARATOR */}
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                  {/* PHASE 4: LEARNING (LMS — Phase 6) */}
                  <ProgramLearningSection
                    programId={id}
                    weekNumber={session.week_number}
                    sessionId={session.id}
                    canEdit={canEdit}
                  />
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
