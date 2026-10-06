"use client";

import { useI18n } from "@/lib/i18n";
import { FileText, X, CheckCircle2, Paperclip, Plus, Target, Trash2 } from "lucide-react";

import SessionModalHeader from "./session-modal/SessionModalHeader";
import SessionModalBasicInfo from "./session-modal/SessionModalBasicInfo";
import SessionModalHandlers from "./session-modal/SessionModalHandlers";
import SessionModalNotes from "./session-modal/SessionModalNotes";
import SessionModalMaterials from "./session-modal/SessionModalMaterials";
import SessionModalKpis from "./session-modal/SessionModalKpis";
import SessionModalRequirements from "./session-modal/SessionModalRequirements";
import SessionModalFooter from "./session-modal/SessionModalFooter";

export default function SessionModal({
  isSaving,
  kpis,
  newRequirement,
  newSession,
  newSessionMaterial,
  onAddSession,
  onAddSessionRequirement,
  onAssigneeTypeChange,
  onAttachSessionMaterial,
  onCloseSessionModal,
  onCloseSessionModal2,
  onDescriptionChange,
  onDueDateChange,
  onEndDateChange,
  onEndTimeChange,
  onNewRequirementChange,
  onNewSession,
  onNewSessionChange,
  onNewSessionMaterial,
  onNewSessionMaterialChange,
  onNewSessionMaterialExternalLinkChange,
  onNotesChange,
  onRequirements,
  onResourceLabelChange,
  onResourceUrlChange,
  onScheduledDateChange,
  onSessionMaterialFile,
  onStartTimeChange,
  onTitleChange,
  onToggleKpi,
  onToggleSessionStaff,
  programTeamMembers,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={onCloseSessionModal}
    >
      <div
        className="card w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(event) => event.stopPropagation()}
      >
        <SessionModalHeader
          t={t}
          newSession={newSession}
          onCloseSessionModal={onCloseSessionModal}
        />
        <div className="space-y-4">
          <SessionModalBasicInfo
            t={t}
            newSession={newSession}
            onNewSessionChange={onNewSessionChange}
            onScheduledDateChange={onScheduledDateChange}
            onEndDateChange={onEndDateChange}
            onStartTimeChange={onStartTimeChange}
            onEndTimeChange={onEndTimeChange}
          />

          <SessionModalHandlers
            t={t}
            newSession={newSession}
            programTeamMembers={programTeamMembers}
            onToggleSessionStaff={onToggleSessionStaff}
          />

          <SessionModalNotes
            t={t}
            newSession={newSession}
            onNotesChange={onNotesChange}
          />

          <SessionModalMaterials
            t={t}
            newSessionMaterial={newSessionMaterial}
            onNewSessionMaterial={onNewSessionMaterial}
            onNewSessionMaterialChange={onNewSessionMaterialChange}
            onNewSessionMaterialExternalLinkChange={onNewSessionMaterialExternalLinkChange}
            onSessionMaterialFile={onSessionMaterialFile}
            onAttachSessionMaterial={onAttachSessionMaterial}
            newSession={newSession}
            onNewSession={onNewSession}
          />

          <SessionModalKpis
            t={t}
            newSession={newSession}
            kpis={kpis}
            onToggleKpi={onToggleKpi}
          />

          <SessionModalRequirements
            t={t}
            newSession={newSession}
            newRequirement={newRequirement}
            kpis={kpis}
            onNewRequirementChange={onNewRequirementChange}
            onTitleChange={onTitleChange}
            onDescriptionChange={onDescriptionChange}
            onDueDateChange={onDueDateChange}
            onAssigneeTypeChange={onAssigneeTypeChange}
            onResourceUrlChange={onResourceUrlChange}
            onResourceLabelChange={onResourceLabelChange}
            onAddSessionRequirement={onAddSessionRequirement}
            onRequirements={onRequirements}
            onNewSession={onNewSession}
          />

          <SessionModalFooter
            t={t}
            isSaving={isSaving}
            newSession={newSession}
            kpis={kpis}
            onAddSession={onAddSession}
            onCloseSessionModal2={onCloseSessionModal2}
          />
        </div>
      </div>
    </div>
  );
}