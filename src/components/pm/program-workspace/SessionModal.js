import { useI18n } from "@/lib/i18n";
import {
  CheckCircle2,
  FileText,
  Paperclip,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";

export default function SessionModal({
  isSaving,
  kpis,
  newRequirement,
  newSession,
  newSessionMaterial,
  onAddSession,
  onAddSessionRequirement,
  onAssigneeTypeChange,
  onAttachSessionMaterial,
  onCloseSessionModal,
  onCloseSessionModal2,
  onDescriptionChange,
  onDueDateChange,
  onEndDateChange,
  onEndTimeChange,
  onNewRequirementChange,
  onNewSession,
  onNewSessionChange,
  onNewSessionMaterial,
  onNewSessionMaterialChange,
  onNewSessionMaterialExternalLinkChange,
  onNotesChange,
  onRequirements,
  onResourceLabelChange,
  onResourceUrlChange,
  onScheduledDateChange,
  onSessionMaterialFile,
  onStartTimeChange,
  onTitleChange,
  onToggleKpi,
  onToggleSessionStaff,
  programTeamMembers,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/40 flex items-center justify-center p-6"
      onClick={onCloseSessionModal}
    >
      <div
        className="card w-full max-w-lg space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-orange/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h3
                className="text-sm font-black uppercase tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {t("pmMisc.workspace.newSessionTitle")}
              </h3>
              <p className="text-[8px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
                {t("pmMisc.workspace.week")} {newSession.week_number}
              </p>
            </div>
          </div>
          <button
            onClick={onCloseSessionModal}
            className="p-2 hover:bg-[var(--surface-2)] rounded-lg transition-all"
          >
            <X className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <label
              className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.sessionTitle")}
            </label>
            <input
              value={newSession.title}
              onChange={(event) =>
                onNewSessionChange((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
              className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold transition-all focus:border-[var(--brand-orange)]"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.sessionTitlePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.startDate")}
              </label>
              <input
                type="date"
                value={newSession.scheduled_date}
                onChange={(event) =>
                  onScheduledDateChange((prev) => ({
                    ...prev,
                    scheduled_date: event.target.value,
                  }))
                }
                className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.finishDate")}
              </label>
              <input
                type="date"
                value={newSession.end_date}
                onChange={(event) =>
                  onEndDateChange((prev) => ({
                    ...prev,
                    end_date: event.target.value,
                  }))
                }
                className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.startTime")}
              </label>
              <input
                type="time"
                value={newSession.start_time}
                onChange={(event) =>
                  onStartTimeChange((prev) => ({
                    ...prev,
                    start_time: event.target.value,
                  }))
                }
                className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
                style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="space-y-1">
              <label
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("pmMisc.workspace.endTime")}
              </label>
              <input
                type="time"
                value={newSession.end_time}
                onChange={(event) =>
                  onEndTimeChange((prev) => ({
                    ...prev,
                    end_time: event.target.value,
                  }))
                }
                className="w-full rounded-xl px-4 py-3 text-sm outline-none font-bold"
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
              {t("pmMisc.workspace.assignHandlers")}
            </label>
            <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto p-1 custom-scrollbar">
              {programTeamMembers.map((staff) => {
                const isSelected = (newSession.handler_ids || []).includes(
                  String(staff.cid),
                );
                return (
                  <button
                    key={staff.cid}
                    type="button"
                    onClick={() => onToggleSessionStaff(staff)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] font-bold transition-all text-left ${
                      isSelected
                        ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                        : "bg-black/20 border-white/5 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[7px]">
                      {staff.name?.charAt(0)}
                    </div>
                    <span className="truncate">{staff.name}</span>
                  </button>
                );
              })}
              {programTeamMembers.length === 0 && (
                <p className="text-[10px] text-slate-600 italic col-span-full px-2">
                  {t("pmMisc.workspace.noStaffAssignedHint")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.sessionNotes")}
            </label>
            <textarea
              value={newSession.notes}
              onChange={(event) =>
                onNotesChange((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none font-bold resize-none"
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-primary)",
                color: "var(--text-primary)",
              }}
              placeholder={t("pmMisc.workspace.sessionNotesPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <label
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("pmMisc.workspace.extraCourseMaterials")}
            </label>
            {/* Material type selector */}
            <div className="flex gap-1 bg-primary rounded-lg p-1 border border-[var(--border-primary)] w-fit">
              {[
                {
                  id: "text",
                  label: t("pmMisc.workspace.materialTypeText"),
                  icon: FileText,
                },
                {
                  id: "link",
                  label: t("pmMisc.workspace.materialTypeLink"),
                  icon: Plus,
                },
                {
                  id: "upload",
                  label: t("pmMisc.workspace.materialTypeFile"),
                  icon: Paperclip,
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onNewSessionMaterial({
                      type: opt.id,
                      content: "",
                      name: "",
                    })
                  }
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                    newSessionMaterial.type === opt.id
                      ? "bg-[var(--brand-orange)] text-black"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <opt.icon className="w-3 h-3" />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Material input */}
            <div className="flex gap-2">
              {newSessionMaterial.type === "text" && (
                <input
                  value={newSessionMaterial.content}
                  onChange={(event) =>
                    onNewSessionMaterialChange((prev) => ({
                      ...prev,
                      content: event.target.value,
                      name: "Text Note",
                    }))
                  }
                  placeholder={t("pmMisc.workspace.textNotePlaceholder")}
                  className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              )}
              {newSessionMaterial.type === "link" && (
                <input
                  type="url"
                  value={newSessionMaterial.content}
                  onChange={(event) =>
                    onNewSessionMaterialExternalLinkChange((prev) => ({
                      ...prev,
                      content: event.target.value,
                      name:
                        event.target.value.split("/").pop() || "External Link",
                    }))
                  }
                  placeholder="https://..."
                  className="flex-1 rounded-lg px-4 py-3 text-sm outline-none font-bold"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              )}
              {newSessionMaterial.type === "upload" && (
                <div className="flex-1 relative group">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={onSessionMaterialFile}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed text-sm font-bold"
                    style={{
                      background: "var(--bg-primary)",
                      borderColor: "var(--border-primary)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Paperclip className="w-4 h-4" />
                    {newSessionMaterial.content ||
                      t("pmMisc.workspace.clickToAttach")}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={onAttachSessionMaterial}
                className="px-4 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
              >
                {t("pmMisc.workspace.add")}
              </button>
            </div>

            {/* Added materials list */}
            {(newSession.extra_materials || []).length > 0 && (
              <div className="space-y-1.5 mt-2">
                {(newSession.extra_materials || []).map((material, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg"
                    style={{
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-primary)",
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {material.type === "text" && (
                        <FileText className="w-3 h-3 text-blue-500 shrink-0" />
                      )}
                      {material.type === "link" && (
                        <Plus className="w-3 h-3 text-emerald-500 shrink-0" />
                      )}
                      {material.type === "upload" && (
                        <Paperclip className="w-3 h-3 text-[#FF6600] shrink-0" />
                      )}
                      <span className="text-[10px] font-bold truncate text-[var(--text-primary)]">
                        {material.name || material.content}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onNewSession((prev) => ({
                          ...prev,
                          extra_materials: (prev.extra_materials || []).filter(
                            (_, materialIndex) => materialIndex !== index,
                          ),
                        }))
                      }
                      className="text-rose-500 hover:scale-110 transition-all shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
              <Target className="w-3 h-3 text-[#FF6600]" />{" "}
              {t("pmMisc.workspace.linkStrategicKpis")}
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar text-left">
              {kpis.map((kpi) => (
                <button
                  key={kpi.id}
                  onClick={() => onToggleKpi("session", kpi.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                    (newSession.kpi_ids || []).includes(kpi.id)
                      ? "bg-[#FF6600]/10 border-[#FF6600] text-white"
                      : "bg-black/20 border-white/5 text-slate-500 hover:border-white/20"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-tight">
                    {kpi.title}
                  </span>
                  {(newSession.kpi_ids || []).includes(kpi.id) && (
                    <CheckCircle2 className="w-3 h-3 text-[#FF6600]" />
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
              <FileText className="w-3 h-3 text-indigo-400" />{" "}
              {t("pmMisc.workspace.deliverablesRequirements")}
            </label>

            {/* List of added requirements */}
            {(newSession.requirements || []).length > 0 && (
              <div className="space-y-2 mb-3">
                {(newSession.requirements || []).map((requirement, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)] shadow-sm"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-[var(--text-primary)] uppercase">
                          {requirement.title}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-orange/10 text-[var(--brand-orange)] uppercase">
                          {requirement.allowed_format}
                        </span>
                      </div>
                      {requirement.due_date && (
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          Due: {requirement.due_date}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onRequirements((prev) => ({
                          ...prev,
                          requirements: prev.requirements.filter(
                            (_, requirementIndex) => requirementIndex !== index,
                          ),
                        }))
                      }
                      className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-md transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Form to add a new requirement */}
            <div className="p-4 bg-[var(--surface-1)] rounded-xl border border-[var(--border-primary)] shadow-inner space-y-4">
              <p className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wider mb-2">
                {t("pmMisc.workspace.configNewReq")}
              </p>

              {/* 1. Type Dropdown */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.reqTypeLabel")}
                </label>
                <select
                  value={newRequirement.allowed_format}
                  onChange={(event) =>
                    onNewRequirementChange((prev) => ({
                      ...prev,
                      allowed_format: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg px-3 py-2 text-xs font-bold outline-none transition-colors"
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
                  <option value="link">
                    {t("pmMisc.workspace.formatLink")}
                  </option>
                  <option value="video">
                    {t("pmMisc.workspace.formatVideo")}
                  </option>
                </select>
              </div>

              {/* 2. Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.titleLabel")}
                </label>
                <input
                  value={newRequirement.title}
                  onChange={(event) =>
                    onTitleChange((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder={t(
                    "pmMisc.workspace.requirementTitlePlaceholder",
                  )}
                  className="w-full rounded-lg px-3 py-2 text-xs font-bold outline-none transition-colors"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* 3. Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.workspace.descLabel")}
                </label>
                <textarea
                  value={newRequirement.description || ""}
                  onChange={(event) =>
                    onDescriptionChange((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder={t("pmMisc.workspace.instructionsPlaceholder")}
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* 4. Conditional URL/Label */}
              {(newRequirement.allowed_format === "link" ||
                newRequirement.allowed_format === "video") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.urlLabel")}
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
                      placeholder={t("pmMisc.workspace.resourceUrlPlaceholder")}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("pmMisc.workspace.btnLabel")}
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
                      placeholder={t(
                        "pmMisc.workspace.resourceLabelPlaceholder",
                      )}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors"
                      style={{
                        background: "var(--bg-primary)",
                        border: "1px solid var(--border-primary)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 5. Due Date & Target */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.deadlineLabel")}
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
                    className="w-full rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("pmMisc.workspace.targetAudienceLabel")}
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
                    className="w-full rounded-lg px-3 py-2 text-xs font-bold outline-none transition-colors"
                    style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="all">
                      {t("pmMisc.workspace.assigneeAll")}
                    </option>
                    <option value="team">
                      {t("pmMisc.workspace.assigneeTeam")}
                    </option>
                    <option value="individual">
                      {t("pmMisc.workspace.assigneeIndividual")}
                    </option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!newRequirement.title.trim()}
                  onClick={onAddSessionRequirement}
                  className="w-full py-2.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border-primary)] text-xs font-black uppercase tracking-widest hover:bg-[var(--surface-3)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />{" "}
                  {t("pmMisc.workspace.addToRequirementList")}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onCloseSessionModal2()}
            className="flex-1 btn btn-secondary"
          >
            {t("pmMisc.workspace.cancel")}
          </button>
          <button
            onClick={onAddSession}
            disabled={
              isSaving ||
              !newSession.title.trim() ||
              (kpis.length > 0 &&
                (!newSession.kpi_ids || newSession.kpi_ids.length === 0))
            }
            className="flex-1 btn btn-primary"
          >
            {isSaving
              ? t("pmMisc.workspace.creating")
              : t("pmMisc.workspace.createSession")}
          </button>
        </div>
      </div>
    </div>
  );
}
