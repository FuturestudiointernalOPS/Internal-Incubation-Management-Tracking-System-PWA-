"use client";

/**
 * The curriculum tab: the programme's sessions, read-only.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function CurriculumTab({ sessions }) {
  return (
    <div className="space-y-3">
      {sessions.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          No sessions scheduled yet.
        </p>
      )}
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
        >
          <div>
            <p className="text-[11px] font-black uppercase">{session.title}</p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">
              Week {session.week_number} \u00b7 {session.type}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
            {session.status || "scheduled"}
          </span>
        </div>
      ))}
    </div>
  );
}
