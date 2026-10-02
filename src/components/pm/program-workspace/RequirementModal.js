import { useI18n } from "@/lib/i18n";
import { Calendar, CheckCircle2, Target, Users, X } from "lucide-react";

export default function RequirementModal({
  isSaving,
  kpis,
  newRequirement,
  onAllowedFormatChange,
  onAssigneeIdChange,
  onAssigneeTypeChange,
  onCloseAddRequirement,
  onCloseRequirementModal,
  onDescriptionChange,
  onDueDateChange,
  onNewRequirementChange,
  onOpenAddRequirement,
  onResourceLabelChange,
  onResourceUrlChange,
  onToggleKpi,
  participants,
  teams,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={() => onCloseRequirementModal()}
    >
      <div
        className="card w-full max-w-sm space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3
            className="text-base font-black uppercase tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {t("pmMisc.workspace.addRequirement")}
          </h3>
          <button onClick={() => onCloseRequirementModal()}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.requirementTitle")}
            </label>
            <input
              value={newRequirement.title}
              onChange={(event) =>
                onNewRequirementChange((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.requirementTitleExample")}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.instructions")}
            </label>
            <textarea
              value={newRequirement.description || ""}
              onChange={(event) =>
                onDescriptionChange((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.instructionsPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.allowedFormat")}
              </label>
              <select
                value={newRequirement.allowed_format}
                onChange={(event) =>
                  onAllowedFormatChange((prev) => ({
                    ...prev,
                    allowed_format: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="pdf">{t("pmMisc.workspace.formatPdf")}</option>
                <option value="image">
                  {t("pmMisc.workspace.formatImage")}
                </option>
                <option value="link">{t("pmMisc.workspace.formatLink")}</option>
                <option value="video">
                  {t("pmMisc.workspace.formatVideo")}
                </option>
              </select>
            </div>
            <div className="space-y-1">
              <label
                className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
                style={{ color: "var(--text-secondary)" }}
              >
                <Calendar className="w-3 h-3" /> {t("pmMisc.workspace.dueDate")}
              </label>
              <input
                type="date"
                value={newRequirement.due_date || ""}
                onChange={(event) =>
                  onDueDateChange((prev) => ({
                    ...prev,
                    due_date: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.resourceUrl")}
            </label>
            <input
              type="text"
              value={newRequirement.resource_url || ""}
              onChange={(event) =>
                onResourceUrlChange((prev) => ({
                  ...prev,
                  resource_url: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.resourceUrlPlaceholder")}
            />
            <p className="text-[8px] text-[var(--text-secondary)]">
              {t("pmMisc.workspace.resourceHint")}
            </p>
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.resourceLabel")}
            </label>
            <input
              type="text"
              value={newRequirement.resource_label || ""}
              onChange={(event) =>
                onResourceLabelChange((prev) => ({
                  ...prev,
                  resource_label: event.target.value,
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.resourceLabelPlaceholder")}
            />
          </div>

          {/* Grading — derived from linked KPIs */}
          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">
              <Target className="w-3 h-3 inline mr-1" />{" "}
              {t("pmMisc.workspace.gradingFromKpis")}
            </p>
            {(() => {
              const linked = kpis.filter((kpi) =>
                (newRequirement.kpi_ids || []).includes(kpi.id),
              );
              if (linked.length === 0) {
                return (
                  <p className="text-[8px] text-slate-500 italic">
                    {t("pmMisc.workspace.gradingKpiHint")}
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-1 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500">
                      {t("pmMisc.workspace.kpisLinked")}
                    </span>{" "}
                    <span className="font-bold text-purple-400">
                      {linked.length}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
              style={{ color: "var(--text-secondary)" }}
            >
              <Users className="w-3 h-3" /> {t("pmMisc.workspace.assignTo")}
            </label>
            <select
              value={newRequirement.assignee_type || "all"}
              onChange={(event) =>
                onAssigneeTypeChange((prev) => ({
                  ...prev,
                  assignee_type: event.target.value,
                  assignee_id: "",
                }))
              }
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
            >
              <option value="all">{t("pmMisc.workspace.assigneeAll")}</option>
              <option value="team">{t("pmMisc.workspace.assigneeTeam")}</option>
              <option value="individual">
                {t("pmMisc.workspace.assigneeIndividual")}
              </option>
            </select>
          </div>

          {newRequirement.assignee_type === "team" && (
            <div className="space-y-1">
              <select
                value={newRequirement.assignee_id || ""}
                onChange={(event) =>
                  onAssigneeIdChange((prev) => ({
                    ...prev,
                    assignee_id: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">{t("pmMisc.workspace.selectTeam")}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newRequirement.assignee_type === "individual" && (
            <div className="space-y-1">
              <select
                value={newRequirement.assignee_id || ""}
                onChange={(event) =>
                  onAssigneeIdChange((prev) => ({
                    ...prev,
                    assignee_id: event.target.value,
                  }))
                }
                className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              >
                <option value="">
                  {t("pmMisc.workspace.selectParticipant")}
                </option>
                {participants.slice(0, 50).map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name} ({participant.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
              <Target className="w-3 h-3 text-[#FF6600]" />{" "}
              {t("pmMisc.workspace.strategicImpact")}
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-[100px] overflow-y-auto p-1 custom-scrollbar text-left">
              {kpis.map((kpi) => (
                <button
                  key={kpi.id}
                  onClick={() => onToggleKpi("requirement", kpi.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    (newRequirement.kpi_ids || []).includes(kpi.id)
                      ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                      : "bg-black/20 border-white/5 text-slate-500 hover:border-white/20"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-tight">
                    {kpi.title}
                  </span>
                  {(newRequirement.kpi_ids || []).includes(kpi.id) && (
                    <CheckCircle2 className="w-3 h-3 text-[#FF6600]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onCloseRequirementModal()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <div className="flex-1 flex flex-col gap-2">
            <button
              onClick={() => onCloseAddRequirement()}
              disabled={
                isSaving ||
                !newRequirement.title.trim() ||
                (newRequirement.kpi_ids || []).length === 0
              }
              className="w-full btn btn-secondary text-[9px] py-2 border-dashed"
            >
              {isSaving
                ? t("pmMisc.workspace.saving")
                : t("pmMisc.workspace.saveAndAddAnother")}
            </button>
            <button
              onClick={() => onOpenAddRequirement()}
              disabled={
                isSaving ||
                !newRequirement.title.trim() ||
                (newRequirement.kpi_ids || []).length === 0
              }
              className="w-full btn btn-primary py-3"
            >
              {isSaving
                ? t("pmMisc.workspace.saving")
                : t("pmMisc.workspace.saveAndClose")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
