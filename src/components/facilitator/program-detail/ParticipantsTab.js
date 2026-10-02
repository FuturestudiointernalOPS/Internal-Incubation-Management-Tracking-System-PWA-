"use client";

/**
 * The participants tab: the participants within the facilitator's scope.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ParticipantsTab({ participants }) {
  return (
    <div className="space-y-3">
      {participants.length === 0 && (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          No participants in your assigned scope.
        </p>
      )}
      {participants.map((participant) => (
        <div
          key={participant.id}
          className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-primary)] bg-secondary"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase truncate">
              {participant.name}
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
              {participant.email}
            </p>
          </div>
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
              participant.status === "active"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {participant.status || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
