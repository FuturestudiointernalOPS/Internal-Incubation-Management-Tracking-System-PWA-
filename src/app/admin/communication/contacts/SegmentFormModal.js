"use client";

import { X } from "lucide-react";

export function SegmentFormModal({
  t,
  showGroupModal,
  newGroupName,
  setNewGroupName,
  newGroupType,
  setNewGroupType,
  newGroupProgramId,
  setNewGroupProgramId,
  programs,
  onClose,
  onSave,
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <div className="card w-full max-w-sm space-y-6 border-brand-orange/30 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold uppercase">
            {typeof showGroupModal === "object"
              ? t("crm.contacts.editSegment")
              : t("crm.contacts.newSegment")}
          </h3>
          <button onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-4">
          <input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder={t("crm.contacts.segmentName")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 font-bold outline-none focus:border-[var(--brand-orange)]"
          />
          <select
            value={newGroupType}
            onChange={(event) => setNewGroupType(event.target.value)}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="individual">{t("crm.contacts.individualFocus")}</option>
            <option value="company">{t("crm.contacts.entityFocus")}</option>
          </select>
          <select
            value={newGroupProgramId}
            onChange={(event) => setNewGroupProgramId(event.target.value)}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold outline-none focus:border-[var(--brand-orange)]"
          >
            <option value="">{t("crm.contacts.selectProgram")}</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <button
            onClick={onSave}
            className="btn btn-primary w-full py-4 font-bold uppercase"
          >
            {t("crm.contacts.syncSegment")}
          </button>
        </div>
      </div>
    </div>
  );
}
