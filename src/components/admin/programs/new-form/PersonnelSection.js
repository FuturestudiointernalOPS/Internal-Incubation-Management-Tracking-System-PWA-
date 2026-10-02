import { Shield, X } from "lucide-react";

/** Program manager + assigned team (assistants). */
export default function PersonnelSection({
  t,
  program,
  setProgram,
  staffList,
  selectedAssistants,
  toggleAssistant,
}) {
  return (
    <div className="card space-y-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-5">
        <Shield className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
          <Shield className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-tight">
          {t("adminMisc.newProgram.assignedManagers")}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
            {t("adminMisc.newProgram.programManager")}
          </label>
          <select
            required
            value={program.assigned_pm_id}
            onChange={(event) =>
              setProgram({ ...program, assigned_pm_id: event.target.value })
            }
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
          >
            <option value="">{t("adminMisc.newProgram.selectManager")}</option>
            {staffList.map((staff) => (
              <option key={staff.cid} value={staff.cid}>
                {staff.name.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-1">
            {t("adminMisc.newProgram.assignedTeam")}
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedAssistants.map((cid) => {
              const staff = staffList.find((staffMember) => staffMember.cid === cid);
              return (
                <div
                  key={cid}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-orange/10 border border-brand-orange/20 rounded-lg text-[10px] font-bold text-[var(--brand-orange)]"
                >
                  {staff?.name.toUpperCase()}
                  <button
                    type="button"
                    onClick={() => toggleAssistant(cid)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) toggleAssistant(event.target.value);
            }}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] cursor-pointer"
          >
            <option value="">{t("adminMisc.newProgram.selectSupport")}</option>
            {staffList
              .filter((staffMember) => !selectedAssistants.includes(staffMember.cid))
              .map((staff) => (
                <option key={staff.cid} value={staff.cid}>
                  {staff.name.toUpperCase()}
                </option>
              ))}
          </select>
        </div>
      </div>
    </div>
  );
}
