import { ChevronRight, Users, Activity, Shield, Trash2, FileText, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import SessionStatusBadge from "./SessionStatusBadge";

export default function SessionCard({
  session,
  canContribute,
  canEdit,
  expandedSessionId,
  kpis,
  onAddSession,
  onDeleteSession,
  onExpandedSessionId,
  onOpenRequirementForSession,
  onOpenSessionAttendance,
  onOpenSessionPMReport,
  onSendRequirementReminder,
  onShowArchivedSessions,
  onToggleSessionExpanded,
  onToggleSessionLock,
  programTeamMembers,
  requirements,
  showArchivedSessions,
  t,
}) {
  return (
    <div
      key={session.id}
      className="card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-brand-orange/50 transition-all shadow-xl bg-secondary group"
    >
      <div
        onClick={() => onExpandedSessionId(expandedSessionId === session.id ? null : session.id)}
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
              <SessionStatusBadge session={session} t={t} />
              {session.scheduled_date && (
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-2">
                  📅{" "}
                  {new Date(session.scheduled_date).toLocaleDateString()}
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
            <ChevronRight className={`w-3 h-3 transition-transform ${expandedSessionId === session.id ? "rotate-90" : ""}`} />
            {expandedSessionId === session.id ? t("pmMisc.workspace.hideDetails") : t("pmMisc.workspace.viewDetails")}
          </button>
        </div>

        <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => onOpenSessionAttendance(session)}
            className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5 transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{t("pmMisc.workspace.attendance")}</span>
          </button>
          {canContribute && (
            <button
              onClick={() => onOpenSessionPMReport(session)}
              className="btn btn-secondary !py-2 !px-4 flex items-center gap-2 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5 transition-all"
            >
              <Activity className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t("pmMisc.workspace.giveWeeklyReport")}</span>
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onToggleSessionLock(session)}
              title={session.status === "locked" ? t("pmMisc.workspace.unlockWeek") : t("pmMisc.workspace.lockWeek")}
              className={`btn btn-secondary !py-2 !px-4 flex items-center gap-2 transition-all ${session.status === "locked" ? "border-rose-500/20 text-rose-500 hover:bg-rose-500/5" : "border-amber-500/20 text-amber-500 hover:bg-amber-500/5"}`}
            >
              <span className="text-sm">{session.status === "locked" ? "🔓" : "🔒"}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {session.status === "locked" ? t("pmMisc.workspace.unlock") : t("pmMisc.workspace.lock")}
              </span>
            </button>
          )}
          {canEdit && (
            <button onClick={() => onDeleteSession(session)} className="p-2 text-rose-500/20 hover:text-rose-500 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}