import { useI18n } from "@/lib/i18n";
import { Calendar, X } from "lucide-react";
import { getLocalToday } from "@/lib/constants";

export default function AttendanceModal({
  attendanceDate,
  attendanceRecords,
  isSaving,
  onAttendanceDateChange,
  onAttendanceRecordsChange,
  onCloseAttendanceModal,
  onSaveAttendance,
  participants,
  selectedSessionForAttendance,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseAttendanceModal()}
    >
      <div
        className="card w-full max-w-2xl space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.attendance")} —{" "}
            {selectedSessionForAttendance.title}
          </h3>
          <button onClick={() => onCloseAttendanceModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 bg-[var(--bg-secondary)] p-3 rounded-xl border border-[var(--border-primary)]">
          <Calendar className="w-4 h-4 text-[var(--text-secondary)]" />
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] mb-1">
              Date
            </p>
            <input
              type="date"
              value={attendanceDate}
              onChange={(event) => onAttendanceDateChange(event.target.value)}
              className="w-full bg-transparent text-sm font-bold text-[var(--text-primary)] outline-none"
              max={getLocalToday()}
              min={getLocalToday()}
            />
          </div>
        </div>

        <div className="space-y-3">
          {participants
            .filter((participant) => participant.status !== "archived")
            .map((participant) => {
              const status = attendanceRecords[participant.id] || "";
              return (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-4 bg-primary rounded-xl border border-[var(--border-primary)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-[10px] font-black uppercase">
                      {participant.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {participant.name}
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)]">
                        {participant.email}
                      </p>
                    </div>
                  </div>
                  <select
                    value={status}
                    onChange={(event) =>
                      onAttendanceRecordsChange((prev) => ({
                        ...prev,
                        [participant.id]: event.target.value,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border outline-none ${
                      !status
                        ? "bg-[var(--border-primary)] text-[var(--text-secondary)] border-[var(--border-primary)]"
                        : status === "present"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    }`}
                  >
                    <option value="">
                      {t("pmMisc.workspace.attendanceSelect")}
                    </option>
                    <option value="present">
                      {t("pmMisc.workspace.attendancePresent")}
                    </option>
                    <option value="absent">
                      {t("pmMisc.workspace.attendanceAbsent")}
                    </option>
                  </select>
                </div>
              );
            })}
          {participants.length === 0 && (
            <p className="text-center text-[var(--text-secondary)] italic py-8">
              {t("pmMisc.workspace.noParticipantsEnrolled")}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onCloseAttendanceModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onSaveAttendance}
            disabled={isSaving}
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.saving")
              : t("pmMisc.workspace.saveAttendance")}
          </button>
        </div>
      </div>
    </div>
  );
}
