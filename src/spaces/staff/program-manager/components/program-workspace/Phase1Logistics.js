import { Clock, Calendar, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Phase1Logistics({
  session,
  canEdit,
  kpis,
  programTeamMembers,
  assignedStaff,
  onUpdateSessionFieldChange,
  onUpdateSessionFieldBlur,
  onEditSessionDescription,
  onUpdateSessionFieldWeekNumberChange,
  onUpdateSessionFieldStartTimeChange,
  onUpdateSessionFieldEndTimeChange,
  onUpdateSessionFieldTimezoneChange,
  onToggleSessionHandler,
  onUpdateSessionFieldScheduledDateChange,
  onUpdateSessionFieldEndDateChange,
  onUpdateSessionStatusChange,
  t,
}) {
  return (
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
              onUpdateSessionFieldChange(session.id, "title", event.target.value)
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
              onUpdateSessionFieldBlur(session.id, "description", event.target.value)
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
                onUpdateSessionFieldWeekNumberChange(session.id, "week_number", event.target.value)
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
                onUpdateSessionFieldStartTimeChange(session.id, "start_time", event.target.value)
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
                onUpdateSessionFieldEndTimeChange(session.id, "end_time", event.target.value)
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
              onUpdateSessionFieldTimezoneChange(session.id, "timezone", event.target.value)
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
            {(programTeamMembers.length > 0 ? programTeamMembers : assignedStaff).map((staffMember) => {
              const stringId = String(staffMember.cid);
              let isSelected = false;
              try {
                const ids = JSON.parse(session.handler_id || "[]");
                isSelected = Array.isArray(ids) ? ids.includes(stringId) : session.handler_id === stringId;
              } catch {
                isSelected = session.handler_id === stringId;
              }
              return (
                <label key={staffMember.cid} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSessionHandler(session, stringId)}
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
                  ? new Date(session.scheduled_date).toISOString().split("T")[0]
                  : ""
              }
              onChange={(event) =>
                onUpdateSessionFieldScheduledDateChange(session.id, "scheduled_date", event.target.value)
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
                  ? new Date(session.end_date).toISOString().split("T")[0]
                  : ""
              }
              onChange={(event) =>
                onUpdateSessionFieldEndDateChange(session.id, "end_date", event.target.value)
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
            onChange={(event) => onUpdateSessionStatusChange(session.id, event.target.value)}
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
            <option value="not started">{t("pmMisc.workspace.sessionStatusNotStarted")}</option>
            <option value="pending">{t("pmMisc.workspace.sessionStatusPending")}</option>
            <option value="in progress">{t("pmMisc.workspace.sessionStatusInProgress")}</option>
            <option value="completed">{t("pmMisc.workspace.sessionStatusCompleted")}</option>
            <option value="locked">{t("pmMisc.workspace.sessionStatusLockedOption")}</option>
          </select>
        </div>
        {session.version > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.workspace.version")}: {session.version}
            </span>
            <span className="text-[7px] text-slate-500">
              ({session.version - 1}{" "}
              {t(session.version > 2 ? "pmMisc.workspace.revisions" : "pmMisc.workspace.revision")})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}