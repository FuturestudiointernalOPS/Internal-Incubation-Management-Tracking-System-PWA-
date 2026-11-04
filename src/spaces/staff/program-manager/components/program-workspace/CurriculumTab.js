import { useI18n } from "@/lib/i18n";
import { Plus } from "lucide-react";
import CoachingRequestsPanel from "@/components/lms/CoachingRequestsPanel";
import SessionCard from "./SessionCard";
import SessionExpanded from "./SessionExpanded";

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
            {showArchivedSessions ? t("pmMisc.workspace.showingArchived") : t("pmMisc.workspace.archived")}
          </button>
          {canEdit && (
            <button onClick={onAddSession} className="btn btn-primary btn-sm gap-2">
              <Plus className="w-4 h-4" /> {t("pmMisc.workspace.create")}
            </button>
          )}
        </div>
      </div>

      <CoachingRequestsPanel programId={id} canEdit={canEdit} />

      <div className="flex flex-col gap-4 mt-4">
        {(sessions || [])
          .filter((session) => showArchivedSessions || session.status !== "archived")
          .map((session) => (
            <>
<SessionCard
  session={session}
  canContribute={canContribute}
  canEdit={canEdit}
  expandedSessionId={expandedSessionId}
  kpis={kpis}
  onAddSession={onAddSession}
  onDeleteSession={onDeleteSession}
  onExpandedSessionId={onExpandedSessionId}
  onOpenRequirementForSession={onOpenRequirementForSession}
  onOpenSessionAttendance={onOpenSessionAttendance}
  onOpenSessionPMReport={onOpenSessionPMReport}
  onSendRequirementReminder={onSendRequirementReminder}
  onShowArchivedSessions={onShowArchivedSessions}
  onToggleSessionExpanded={onToggleSessionExpanded}
  onToggleSessionLock={onToggleSessionLock}
  onToggleSessionHandler={onToggleSessionHandler}
  programTeamMembers={programTeamMembers}
  requirements={requirements}
  showArchivedSessions={showArchivedSessions}
  t={t}
/>
<SessionExpanded
  session={session}
  canContribute={canContribute}
  canEdit={canEdit}
  expandedSessionId={expandedSessionId}
  kpis={kpis}
  onOpenRequirementForSession={onOpenRequirementForSession}
  onSendRequirementReminder={onSendRequirementReminder}
  onUpdateSessionFieldBlur={onUpdateSessionFieldBlur}
  onUpdateSessionFieldChange={onUpdateSessionFieldChange}
  onUpdateSessionFieldEndDateChange={onUpdateSessionFieldEndDateChange}
  onUpdateSessionFieldEndTimeChange={onUpdateSessionFieldEndTimeChange}
  onUpdateSessionFieldScheduledDateChange={onUpdateSessionFieldScheduledDateChange}
  onUpdateSessionFieldStartTimeChange={onUpdateSessionFieldStartTimeChange}
  onUpdateSessionFieldTimezoneChange={onUpdateSessionFieldTimezoneChange}
  onUpdateSessionFieldWeekNumberChange={onUpdateSessionFieldWeekNumberChange}
  onUpdateSessionStatusChange={onUpdateSessionStatusChange}
  onEditSessionDescription={onEditSessionDescription}
  onToggleSessionHandler={onToggleSessionHandler}
  onOpenSessionAttendance={onOpenSessionAttendance}
  onOpenSessionPMReport={onOpenSessionPMReport}
  onToggleSessionLock={onToggleSessionLock}
  onDeleteSession={onDeleteSession}
  programTeamMembers={programTeamMembers}
  requirements={requirements}
  assignedStaff={assignedStaff}
  t={t}
/>
            </>
          ))}
      </div>
    </div>
  );
}