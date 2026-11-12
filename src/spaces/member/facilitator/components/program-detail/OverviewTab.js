"use client";

/**
 * The overview tab: participant/session/duration counters and the programme
 * description and outcomes.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function OverviewTab({
  program,
  participantCount,
  sessionCount,
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            Participants
          </p>
          <p className="text-2xl font-black">{participantCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            Sessions
          </p>
          <p className="text-2xl font-black">{sessionCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            Duration
          </p>
          <p className="text-2xl font-black">
            {program?.duration_weeks || "\u2014"} wks
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
            Description
          </p>
          <p className="text-sm">{program?.description || "\u2014"}</p>
        </div>
        {program?.outcomes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
              Outcomes
            </p>
            <p className="text-sm">{program.outcomes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
