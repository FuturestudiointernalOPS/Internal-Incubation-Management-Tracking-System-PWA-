import { Plus } from "lucide-react";

/** Basic identity, dates, type/visibility/language and narrative fields. */
export default function ProgramFieldsSection({
  t,
  program,
  setProgram,
  todayStr,
  dateError,
  validateDates,
  customProgramTypes,
  showNewTypeInput,
  setShowNewTypeInput,
  newTypeInput,
  setNewTypeInput,
  onAddProgramType,
}) {
  return (
    <>
      {/* SECTION: BASIC IDENTITY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.programName")}
          </label>
          <input
            required
            value={program.name}
            onChange={(event) =>
              setProgram({ ...program, name: event.target.value })
            }
            placeholder={t("adminMisc.newProgram.namePlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("adminMisc.newProgram.startDate")}
          </label>
          <input
            required
            type="date"
            min={todayStr}
            value={program.start_date}
            onChange={(event) => {
              const startDate = event.target.value;
              setProgram({ ...program, start_date: startDate });
              validateDates(startDate, program.end_date);
            }}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("adminMisc.newProgram.endDate")}
          </label>
          <input
            required
            type="date"
            value={program.end_date}
            onChange={(event) => {
              const endDate = event.target.value;
              setProgram({ ...program, end_date: endDate });
              validateDates(program.start_date, endDate);
            }}
            className={`w-full bg-secondary border rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all ${dateError ? "border-rose-500" : "border-[var(--border-primary)]"}`}
          />
          {dateError && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mt-1 ml-2">
              {dateError}
            </p>
          )}
          {program.start_date &&
            program.end_date &&
            !dateError &&
            (() => {
              const diffDays = Math.ceil(
                (new Date(program.end_date) - new Date(program.start_date)) /
                  (1000 * 60 * 60 * 24),
              );
              const weeks = Math.max(1, Math.ceil(diffDays / 7));
              return (
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mt-1 ml-2">
                  {t("adminMisc.newProgram.computedDuration", { weeks })}
                </p>
              );
            })()}
        </div>
      </div>

      {/* Program Type & Vision & Objectives */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.programType")}
          </label>
          <div className="flex gap-2">
            <select
              value={program.program_type || "incubation"}
              onChange={(event) =>
                setProgram({ ...program, program_type: event.target.value })
              }
              className="flex-1 bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
            >
              <option value="incubation">
                {t("admin.programTypes.incubation")}
              </option>
              <option value="acceleration">
                {t("admin.programTypes.acceleration")}
              </option>
              <option value="bootcamp">
                {t("admin.programTypes.bootcamp")}
              </option>
              <option value="workshop">
                {t("admin.programTypes.workshop")}
              </option>
              <option value="fellowship">
                {t("admin.programTypes.fellowship")}
              </option>
              {customProgramTypes.map((customType, index) => (
                <option key={index} value={customType}>
                  {customType.toUpperCase()}
                </option>
              ))}
              <option value="custom">{t("admin.programTypes.custom")}</option>
            </select>
            <button
              type="button"
              onClick={() => setShowNewTypeInput(!showNewTypeInput)}
              className="px-4 bg-brand-orange/10 text-[var(--brand-orange)] border border-brand-orange/20 rounded-2xl hover:bg-brand-orange/20 transition-all shrink-0"
              title={t("adminMisc.newProgram.addTypeTitle")}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showNewTypeInput && (
            <div className="flex gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
              <input
                type="text"
                value={newTypeInput}
                onChange={(event) => setNewTypeInput(event.target.value)}
                placeholder={t("adminMisc.newProgram.newTypePlaceholder")}
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
              />
              <button
                type="button"
                onClick={onAddProgramType}
                className="px-4 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20"
              >
                {t("adminMisc.newProgram.addType")}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.visibility")}
          </label>
          <select
            value={program.visibility || "private"}
            onChange={(event) =>
              setProgram({ ...program, visibility: event.target.value })
            }
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="private">
              {t("admin.visibilityOptions.private")}
            </option>
            <option value="public">
              {t("admin.visibilityOptions.public")}
            </option>
            <option value="invite_only">
              {t("admin.visibilityOptions.inviteOnly")}
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.language")}
          </label>
          <select
            value={program.language || "en"}
            onChange={(event) =>
              setProgram({ ...program, language: event.target.value })
            }
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-lg font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.vision")}
          </label>
          <textarea
            rows={3}
            value={program.vision || ""}
            onChange={(event) =>
              setProgram({ ...program, vision: event.target.value })
            }
            placeholder={t("adminMisc.newProgram.visionPlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("admin.objectives")}
          </label>
          <textarea
            rows={3}
            value={program.objectives || ""}
            onChange={(event) =>
              setProgram({ ...program, objectives: event.target.value })
            }
            placeholder={t("adminMisc.newProgram.objectivesPlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />
        </div>
      </div>

      {/* Expected Outcomes & Success Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("adminMisc.newProgram.expectedOutcomes")}
          </label>
          <textarea
            rows={3}
            value={program.expected_outcomes || ""}
            onChange={(event) =>
              setProgram({ ...program, expected_outcomes: event.target.value })
            }
            placeholder={t("adminMisc.newProgram.expectedOutcomesPlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("adminMisc.newProgram.successMetrics")}
          </label>
          <textarea
            rows={3}
            value={program.success_metrics || ""}
            onChange={(event) =>
              setProgram({ ...program, success_metrics: event.target.value })
            }
            placeholder={t("adminMisc.newProgram.successMetricsPlaceholder")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 font-medium text-white outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
          />
        </div>
      </div>
    </>
  );
}
