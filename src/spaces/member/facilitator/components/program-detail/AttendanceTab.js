"use client";

import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getLocalToday } from "@/lib/constants";

/**
 * The attendance tab: the date picker and, per session, one mark per
 * participant with a per-session bulk save.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function AttendanceTab({
  sessions,
  participants,
  attendanceDate,
  onDateChange,
  attendance,
  onMark,
  onSaveSession,
  onSaveParticipant,
  savingAtt,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-primary p-3">
        <CalendarCheck className="w-4 h-4 text-[var(--text-secondary)]" />
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            Date
          </p>
          <input
            type="date"
            value={attendanceDate}
            onChange={(event) => onDateChange(event.target.value)}
            max={getLocalToday()}
            min={getLocalToday()}
            className="w-full bg-transparent text-sm font-bold text-[var(--text-primary)] outline-none"
          />
        </div>
      </div>
      {sessions.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          No sessions scheduled yet.
        </p>
      )}
      {sessions.map((session) => (
        <div
          key={session.id}
          className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-black uppercase">
                {session.title}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                Week {session.week_number} · {session.type}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {participants.map((participant) => {
              const key = `${session.id}:${participant.id || participant.user_id}`;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--border-primary)] bg-primary"
                >
                  <span className="text-[10px] font-bold uppercase truncate">
                    {participant.name}
                  </span>
                  <select
                    value={attendance[key] || ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      onMark(key, value);
                      onSaveParticipant(session.id, participant.id || participant.user_id, value);
                    }}
                    className="bg-secondary border border-[var(--border-primary)] rounded px-1.5 py-1 text-[10px] font-bold uppercase outline-none cursor-pointer"
                  >
                    <option value="">{t("pmMisc.workspace.attendanceSelect")}</option>
                    <option value="present">{t("pmMisc.workspace.attendancePresent")}</option>
                    <option value="absent">{t("pmMisc.workspace.attendanceAbsent")}</option>
                  </select>
                </div>
              );
            })}
          </div>
          <button
            disabled={savingAtt}
            onClick={() => onSaveSession(session.id)}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-500/20 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Save attendance
          </button>
        </div>
      ))}
    </div>
  );
}
