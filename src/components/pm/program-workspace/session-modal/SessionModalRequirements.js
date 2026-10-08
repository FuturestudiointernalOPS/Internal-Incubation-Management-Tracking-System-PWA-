"use client";

import { useI18n } from "@/lib/i18n";
import { FileText, Plus, CheckCircle2, Trash2 } from "lucide-react";
import AssigneeSelect from "./AssigneeSelect";

export default function SessionModalRequirements({
  t,
  newSession,
  newRequirement,
  kpis,
  onNewRequirementChange,
  onTitleChange,
  onDescriptionChange,
  onDueDateChange,
  onAssigneeTypeChange,
  onResourceUrlChange,
  onResourceLabelChange,
  onAddSessionRequirement,
  onRequirements,
  onNewSession,
}) {
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
        <FileText className="w-3 h-3 text-indigo-400" />{" "}
        {t("pmMisc.workspace.deliverablesRequirements")}
      </label>

      <div className="space-y-2 mb-3">
        {(newSession.requirements || []).map((requirement, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border-primary shadow-sm"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-text-primary uppercase">
                  {requirement.title}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-orange/10 text-brand-orange uppercase">
                  {requirement.allowed_format}
                </span>
              </div>
              {requirement.due_date && (
                <span className="text-[10px] text-text-secondary">
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

      <div className="p-4 bg-surface-1 rounded-xl border border-border-primary shadow-inner space-y-4">
        <p className="text-[10px] font-bold text-brand-orange uppercase tracking-wider mb-2">
          {t("pmMisc.workspace.configNewReq")}
        </p>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
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

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
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

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
              {t("pmMisc.workspace.targetAudienceLabel")}
            </label>
            <AssigneeSelect
              value={newRequirement.assignee_type || "all"}
              onChange={onAssigneeTypeChange}
              disabled={!newRequirement.title.trim()}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={!newRequirement.title.trim()}
            onClick={onAddSessionRequirement}
            className="w-full py-2.5 rounded-lg bg-surface-2 text-text-primary border border-border-primary text-xs font-black uppercase tracking-widest hover:bg-surface-3 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />{" "}
            {t("pmMisc.workspace.addToRequirementList")}
          </button>
        </div>
      </div>
    </div>
  );
}