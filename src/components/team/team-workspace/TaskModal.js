"use client";

import { useI18n } from "@/lib/i18n";
import { Loader2, Save, X } from "lucide-react";

/**
 * The task sheet, used both to add a task and to edit one.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function TaskModal({
  form,
  editing,
  saving,
  members,
  onChange,
  onClose,
  onSave,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
            {editing ? t("rootMisc.team.editTask") : t("rootMisc.team.newTask")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("rootMisc.team.title")}
            </label>
            <input
              value={form.title}
              onChange={(event) => onChange("title", event.target.value)}
              placeholder={t("rootMisc.team.taskTitlePlaceholder")}
              className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("rootMisc.team.description")}
            </label>
            <textarea
              value={form.description}
              onChange={(event) => onChange("description", event.target.value)}
              placeholder={t("rootMisc.team.descriptionPlaceholder")}
              rows={2}
              className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("rootMisc.team.priority")}
              </label>
              <select
                value={form.priority}
                onChange={(event) => onChange("priority", event.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60 transition-colors appearance-none cursor-pointer"
              >
                <option value="low">{t("rootMisc.team.priorityLow")}</option>
                <option value="medium">{t("rootMisc.team.priorityMedium")}</option>
                <option value="high">{t("rootMisc.team.priorityHigh")}</option>
                <option value="critical">{t("rootMisc.team.priorityCritical")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("rootMisc.team.assignTo")}
              </label>
              <select
                value={form.assigned_to}
                onChange={(event) => onChange("assigned_to", event.target.value)}
                className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60 transition-colors appearance-none cursor-pointer"
              >
                <option value="">{t("rootMisc.team.anyone")}</option>
                {members.map((member) => (
                  <option key={member.cid || member.id} value={member.cid || member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 pb-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest rounded-xl hover:bg-[var(--surface-3)] transition-colors"
          >
            {t("rootMisc.team.cancel")}
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("rootMisc.team.saving")}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> {t("rootMisc.team.create")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}