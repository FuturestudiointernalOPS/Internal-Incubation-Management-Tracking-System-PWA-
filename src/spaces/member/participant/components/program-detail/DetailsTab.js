import { translateStatus } from "./translateStatus";

export default function DetailsTab({ t, program, curriculum, kpis }) {
  return (
    <>
  <div className="space-y-4">
    {/* Program Info */}
    <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
        {t("participant.programInfo")}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.status")}
          </p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
            {translateStatus(program.status || "active", t)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.duration")}
          </p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
            {program.durationWeeks || "?"} {t("participant.weeks")}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.startDate")}
          </p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
            {program.startDate
              ? new Date(program.startDate).toLocaleDateString()
              : "TBD"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.endDate")}
          </p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
            {program.endDate
              ? new Date(program.endDate).toLocaleDateString()
              : "TBD"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("participant.currentWeek")}
          </p>
          <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
            {t("participant.week")} {curriculum.currentWeek}
          </p>
        </div>
        {program.pmName && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("participant.programManager")}
            </p>
            <p className="text-[12px] font-bold text-[var(--text-primary)] mt-1">
              {program.pmName}
            </p>
          </div>
        )}
      </div>
    </div>

    {/* KPIs */}
    {kpis.length > 0 && (
      <div className="bg-[var(--bg-tertiary)] rounded-xl p-5 border border-[var(--border-primary)]">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
          {t("participant.keyPerformanceIndicators")}
        </h3>
        <div className="space-y-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="flex items-center justify-between"
            >
              <span className="text-[10px] font-bold text-[var(--text-primary)]">
                {kpi.title}
              </span>
              <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                {kpi.current_value || 0} / {kpi.target_value || 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
    </>
  );
}
