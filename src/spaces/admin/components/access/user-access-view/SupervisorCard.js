import { UserCheck } from "lucide-react";

export default function SupervisorCard({
  currentSupervisor,
  supervisorMsg,
  supervisorError,
  removeSupervisor,
  savingSupervisor,
  showSupervisorPicker,
  setShowSupervisorPicker,
  supervisorQuery,
  setSupervisorQuery,
  filteredSupervisors,
  assignSupervisor,
  t,
}) {
  return (
    <>
      <div className="ios-card !p-5 border-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="w-4 h-4 text-[var(--brand-orange)]" />
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("adminMisc.access.supervisor")}
          </h3>
        </div>

        {supervisorMsg && (
          <p className="text-sm font-bold text-emerald-400 mb-2">
            {supervisorMsg}
          </p>
        )}
        {supervisorError && (
          <p className="text-sm font-bold text-red-400 mb-2">
            {supervisorError}
          </p>
        )}

        {currentSupervisor ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                {currentSupervisor.name}
              </p>
              {currentSupervisor.email && (
                <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                  {currentSupervisor.email}
                </p>
              )}
            </div>
            <button
              onClick={removeSupervisor}
              disabled={savingSupervisor}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wide hover:bg-red-500/20 transition-all disabled:opacity-40"
            >
              {t("adminMisc.access.removeSupervisor")}
            </button>
          </div>
        ) : showSupervisorPicker ? (
          <div className="space-y-2">
            <input
              value={supervisorQuery}
              onChange={(event) => setSupervisorQuery(event.target.value)}
              placeholder={t("adminMisc.access.supervisorSearchPlaceholder")}
              className="w-full bg-secondary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50"
            />
            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
              {filteredSupervisors.map((person) => (
                <button
                  key={person.cid}
                  onClick={() => assignSupervisor(person)}
                  disabled={savingSupervisor}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-tertiary transition-all text-left"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide truncate">
                      {person.name || person.cid}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                      {person.email}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--brand-orange)] shrink-0">
                    {person.role}
                  </span>
                </button>
              ))}
              {filteredSupervisors.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)] py-2 text-center">
                  {t("adminMisc.access.supervisorNoResults")}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setShowSupervisorPicker(false);
                setSupervisorQuery("");
              }}
              className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSupervisorPicker(true)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-dashed border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)] hover:border-brand-orange/40 transition-all"
          >
            {t("adminMisc.access.assignSupervisor")}
          </button>
        )}
      </div>
    </>
  );
}