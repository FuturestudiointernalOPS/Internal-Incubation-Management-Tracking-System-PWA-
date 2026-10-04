import { FileText, Plus, Bell, Trash2, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function Phase2Curriculum({
  session,
  canEdit,
  requirements,
  onOpenRequirementForSession,
  onSendRequirementReminder,
  t,
}) {
  const sessionRequirements = requirements.filter((requirement) => requirement.session_id === session.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-brand-orange/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center text-[9px] font-black text-[var(--brand-orange)] border border-brand-orange/20 shadow-sm">
            2
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-orange)]">
            {t("pmMisc.workspace.curriculumAssessments")}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => onOpenRequirementForSession(session)}
            className="text-[9px] font-black text-[var(--brand-orange)] uppercase hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />{" "}
            {t("pmMisc.workspace.addRequirement")}
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
        {sessionRequirements.map((requirement) => (
          <div
            key={requirement.id}
            className="flex items-center justify-between p-4 bg-primary rounded-2xl border border-[var(--border-primary)] hover:border-brand-orange/30 transition-all shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/5 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-xs font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {requirement.title}
                </p>
                <p className="text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest mt-0.5 italic flex items-center gap-2">
                  <span>
                    {t("pmMisc.workspace.requirement")}:{" "}
                    {requirement.allowed_format || "PDF"}
                  </span>
                  {requirement.due_date && (() => {
                    const now = new Date();
                    const due = new Date(requirement.due_date);
                    const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const isDueSoon = diffDays >= 0 && diffDays <= 3;
                    return (
                      <>
                        <span>•</span>
                        <span className={isOverdue ? "text-rose-500" : isDueSoon ? "text-amber-500" : "text-amber-500/60"}>
                          {t("pmMisc.workspace.due")}: {due.toLocaleDateString()}
                        </span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-rose-500/20 text-rose-400">
                            {t("pmMisc.workspace.overdue")}
                          </span>
                        )}
                        {isDueSoon && (
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-amber-500/20 text-amber-400">
                            {t("pmMisc.workspace.dueSoon")}
                          </span>
                        )}
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {requirement.due_date && canEdit && (
                <button
                  onClick={() => onSendRequirementReminder(requirement)}
                  className="text-[7px] font-black uppercase text-brand-orange/60 hover:text-[var(--brand-orange)] transition-all px-2 py-1 rounded border border-brand-orange/20 hover:border-brand-orange/50"
                  title={t("pmMisc.workspace.sendReminderTitle")}
                >
                  <Bell className="w-3 h-3 inline mr-1" />
                  {t("pmMisc.workspace.remind")}
                </button>
              )}
              {canEdit && (
                <button className="text-rose-500/10 hover:text-rose-500 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {sessionRequirements.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-primary)] rounded-3xl opacity-30">
            <Shield className="w-10 h-10 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">
              {t("pmMisc.workspace.noRequirementsSet")}
            </p>
          </div>
        )}
      </div>
      <p className="text-[8px] font-bold text-slate-500/50 uppercase tracking-widest italic text-center px-6">
        {t("pmMisc.workspace.curriculumEvidenceNote")}
      </p>
    </div>
  );
}