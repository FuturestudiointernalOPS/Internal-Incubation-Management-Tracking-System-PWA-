import Phase1Logistics from "./Phase1Logistics";
import Phase2Curriculum from "./Phase2Curriculum";
import ProgramLearningSection from "@/components/lms/ProgramLearningSection";

export default function SessionExpanded({
  session,
  canContribute,
  canEdit,
  expandedSessionId,
  kpis,
  onOpenRequirementForSession,
  onSendRequirementReminder,
  onUpdateSessionFieldBlur,
  onUpdateSessionFieldChange,
  onUpdateSessionFieldEndDateChange,
  onUpdateSessionFieldEndTimeChange,
  onUpdateSessionFieldScheduledDateChange,
  onUpdateSessionFieldStartTimeChange,
  onUpdateSessionFieldTimezoneChange,
  onUpdateSessionFieldWeekNumberChange,
  onUpdateSessionStatusChange,
  onEditSessionDescription,
  onToggleSessionHandler,
  onOpenSessionAttendance,
  onOpenSessionPMReport,
  onToggleSessionLock,
  onDeleteSession,
  programTeamMembers,
  requirements,
  assignedStaff,
  t,
}) {
  if (expandedSessionId !== session.id) return null;

  return (
    <div className="p-6">
      <div className="space-y-8">
        <Phase1Logistics
          session={session}
          canEdit={canEdit}
          kpis={kpis}
          programTeamMembers={programTeamMembers}
          assignedStaff={assignedStaff}
          onUpdateSessionFieldChange={onUpdateSessionFieldChange}
          onUpdateSessionFieldBlur={onUpdateSessionFieldBlur}
          onEditSessionDescription={onEditSessionDescription}
          onUpdateSessionFieldWeekNumberChange={onUpdateSessionFieldWeekNumberChange}
          onUpdateSessionFieldStartTimeChange={onUpdateSessionFieldStartTimeChange}
          onUpdateSessionFieldEndTimeChange={onUpdateSessionFieldEndTimeChange}
          onUpdateSessionFieldTimezoneChange={onUpdateSessionFieldTimezoneChange}
          onToggleSessionHandler={onToggleSessionHandler}
          onUpdateSessionFieldScheduledDateChange={onUpdateSessionFieldScheduledDateChange}
          onUpdateSessionFieldEndDateChange={onUpdateSessionFieldEndDateChange}
          onUpdateSessionStatusChange={onUpdateSessionStatusChange}
          t={t}
        />

        <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        <Phase2Curriculum
          session={session}
          canEdit={canEdit}
          requirements={requirements}
          onOpenRequirementForSession={onOpenRequirementForSession}
          onSendRequirementReminder={onSendRequirementReminder}
          t={t}
        />

        <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

        <ProgramLearningSection
          programId={session.program_id || session.id}
          weekNumber={session.week_number}
          sessionId={session.id}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}