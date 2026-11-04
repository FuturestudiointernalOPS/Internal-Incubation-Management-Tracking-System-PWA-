"use client";

import { useI18n } from "@/lib/i18n";

// The programme and status filters. The list owns the values; this block only
// shows them and reports a choice back.

export default function FiltersBar({
  filterProgram,
  setFilterProgram,
  filterStatus,
  setFilterStatus,
  programs,
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filterProgram}
        onChange={(event) => setFilterProgram(event.target.value)}
        className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
      >
        <option value="all">{t("participantMisc.assignments.filterAllPrograms")}</option>
        {programs.map((program) => (
          <option key={program.id} value={program.id}>
            {program.name}
          </option>
        ))}
      </select>
      <select
        value={filterStatus}
        onChange={(event) => setFilterStatus(event.target.value)}
        className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
      >
        <option value="all">{t("participantMisc.assignments.filterAllStatus")}</option>
        <option value="pending">{t("participantMisc.assignments.filterPending")}</option>
        <option value="overdue">{t("participantMisc.assignments.filterOverdue")}</option>
        <option value="submitted">{t("participantMisc.assignments.filterSubmitted")}</option>
        <option value="approved">{t("participantMisc.assignments.filterApproved")}</option>
        <option value="rejected">{t("participantMisc.assignments.filterRejected")}</option>
        <option value="revision_requested">{t("participantMisc.assignments.filterRevision")}</option>
      </select>
    </div>
  );
}
