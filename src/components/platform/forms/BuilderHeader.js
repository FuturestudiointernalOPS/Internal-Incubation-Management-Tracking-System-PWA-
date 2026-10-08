import { Sparkles, BarChart3, GitBranch, Mail, Eye, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FORM_STATUS_KEYS } from "./constants";

export default function BuilderHeader({
  editingForm, showAiEval, showScoring, showWorkflow, showTemplates,
  aiEvalFramework, scoringConfig, workflowConfig, templateConfig,
  previewMode, saving,
  onToggleAiEval, onToggleScoring, onToggleWorkflow, onToggleTemplates,
  onTogglePreview, onBack, onSave, onRepublish, onPublish, onLaunchRun,
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">← {t("platformMisc.forms.back")}</button>
        <span className="text-[var(--text-secondary)] opacity-30">|</span>
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h2>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${editingForm?.status === "published" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"}`}>{editingForm?.status ? (FORM_STATUS_KEYS[editingForm.status] ? t("platformMisc.forms." + FORM_STATUS_KEYS[editingForm.status]) : editingForm.status) : t("platformMisc.forms.statusDraft")}</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onToggleAiEval} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showAiEval ? "bg-purple-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
          <Sparkles className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderAiEval")} {aiEvalFramework && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
        </button>
        <button onClick={onToggleScoring} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showScoring ? "bg-indigo-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
          <BarChart3 className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderScoring")} {scoringConfig?.enabled && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
        </button>
        <button onClick={onToggleWorkflow} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showWorkflow ? "bg-amber-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
          <GitBranch className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderWorkflow")} {workflowConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
        </button>
        <button onClick={onToggleTemplates} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${showTemplates ? "bg-cyan-500 text-white" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
          <Mail className="w-3 h-3 inline mr-1.5" />{t("platformMisc.forms.builderTemplates")} {templateConfig && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
        </button>
        <button onClick={onTogglePreview} className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all ${previewMode ? "bg-[var(--brand-orange)] text-black" : "bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>
          <Eye className="w-3 h-3 inline mr-1.5" />{previewMode ? t("platformMisc.forms.previewEditing") : t("platformMisc.forms.previewPreview")}
        </button>
        <button onClick={onSave} disabled={saving} className="px-3 py-2 rounded-xl bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{saving ? t("platformMisc.forms.saving") : t("platformMisc.forms.save")}</button>
        {editingForm?.status === "published" ? (
          <>
            <button onClick={onRepublish} disabled={saving} className="px-3 py-2 rounded-xl bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-600 transition-all">
              {saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.republish")}
            </button>
            <button onClick={onLaunchRun} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 shadow-[0_0_15px_rgba(255,102,0,0.3)] border border-[var(--brand-orange)] flex items-center">
              <Play className="w-3 h-3 inline mr-1.5" /> {saving ? t("platformMisc.forms.creating") : t("platformMisc.forms.launchAndCollect")}
            </button>
          </>
        ) : (
          <button onClick={onPublish} disabled={saving} className="px-4 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110">{saving ? t("platformMisc.forms.publishing") : t("platformMisc.forms.publish")}</button>
        )}
      </div>
    </div>
  );
}
