import { GitBranch, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_AUTOMATION, DECISION_DEFAULT_KEYS, WORKFLOW_STATUS_LABEL_KEYS } from "./constants";

function Toggle({ autoCfg, update, path, label, desc }) {
  const keys = path.split(".");
  let currentValue = autoCfg;
  for (const key of keys) currentValue = currentValue?.[key];
  return (
    <label className="flex items-center gap-3 p-2 rounded-lg bg-tertiary/50 cursor-pointer hover:bg-amber-500/5 transition-all">
      <input type="checkbox" checked={!!currentValue} onChange={(event) => update(path, event.target.checked)} className="w-3.5 h-3.5 rounded accent-amber-500 shrink-0" />
      <div><p className="text-[10px] font-bold text-[var(--text-primary)]">{label}</p>{desc && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{desc}</p>}</div>
    </label>
  );
}

export default function WorkflowPanel({ workflowConfig, setWorkflowConfig, automationConfig, setAutomationConfig, onSave, saving, onClose }) {
  const { t } = useI18n();
  const workflow = workflowConfig || { decisions: [], statusLabels: {} };
  const defaults = [
    { id: "approved", defaultLabel: "Approve", defaultColor: "emerald" },
    { id: "rejected", defaultLabel: "Reject", defaultColor: "rose" },
    { id: "revision_requested", defaultLabel: "Request Revision", defaultColor: "amber" },
  ];
  const decisions = defaults.map(defaultDecision => {
    const existing = (workflow.decisions || []).find(candidate => candidate.id === defaultDecision.id);
    return existing || { id: defaultDecision.id, label: defaultDecision.defaultLabel, color: defaultDecision.defaultColor, icon: "CheckCircle2" };
  });
  const autoCfg = automationConfig || DEFAULT_AUTOMATION;
  const updateAutomation = (path, value) => {
    const nextConfig = JSON.parse(JSON.stringify(autoCfg));
    const keys = path.split(".");
    let target = nextConfig;
    for (let keyIndex = 0; keyIndex < keys.length - 1; keyIndex++) target = target[keys[keyIndex]];
    target[keys[keys.length - 1]] = value;
    setAutomationConfig(nextConfig);
  };

  return (
    <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.workflowConfigTitle")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            onClick={onSave}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-amber-600 transition-all"
          >
            {t("platformMisc.forms.workflowSave")}
          </button>
          <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        {t("platformMisc.forms.workflowHint")}
      </p>

      <div className="space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)]">{t("platformMisc.forms.workflowDecisionButtons")}</h4>
        <div className="grid grid-cols-3 gap-3">
          {decisions.map((decision, index) => (
            <div key={decision.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {decision.id === "approved" ? t("platformMisc.forms.decisionPositive") : decision.id === "rejected" ? t("platformMisc.forms.decisionNegative") : t("platformMisc.forms.decisionNeedsWork")}
              </label>
              <input
                value={decision.label}
                onChange={event => {
                  const nextDecisions = [...decisions];
                  nextDecisions[index] = { ...nextDecisions[index], label: event.target.value };
                  setWorkflowConfig({ ...workflow, decisions: nextDecisions });
                }}
                placeholder={t("platformMisc.forms." + DECISION_DEFAULT_KEYS[decision.id])}
                className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
          ))}
        </div>

        <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] pt-2">{t("platformMisc.forms.workflowStatusLabels")}</h4>
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: "submitted", defaultLabel: "Submitted" },
            { id: "approved", defaultLabel: "Approved" },
            { id: "rejected", defaultLabel: "Rejected" },
            { id: "revision_requested", defaultLabel: "Revision" },
            { id: "draft", defaultLabel: "Draft" },
          ].map(statusOption => {
            const labelValue = (workflow.statusLabels || {})[statusOption.id] || "";
            return (
              <div key={statusOption.id} className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[statusOption.id])} →</label>
                <input
                  value={labelValue}
                  onChange={event => setWorkflowConfig({ ...workflow, statusLabels: { ...(workflow.statusLabels || {}), [statusOption.id]: event.target.value } })}
                  placeholder={t("platformMisc.forms." + WORKFLOW_STATUS_LABEL_KEYS[statusOption.id])}
                  className="w-full px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                />
              </div>
            );
          })}
        </div>

        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowAutomationActions")}</h4>
        <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowAutomationHint")}</p>

        <div className="space-y-2 pl-1">
          {/* The applicant-email switches are a RUN decision: the run's
              Settings tab owns them (see the run screen). The form
              keeps only its scoring policy below. Values already
              stored here stay as the default every run of this form
              inherits — lib/platform/automationSettings.js resolves
              run → form → on — so nothing configured before this
              change stops applying. */}
          <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.automationMovedToRun")}</p>
          <p className="text-[10px] font-bold text-emerald-400 uppercase pt-2">{t("platformMisc.forms.automationAutoApproval")}</p>
          <Toggle autoCfg={autoCfg} update={updateAutomation} path="auto_approve" label={t("platformMisc.forms.autoApproveScoreLabel")} desc={t("platformMisc.forms.autoApproveScoreDesc")} />
          <div className="flex items-center gap-3 pt-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.autoCutoffScore")}</label>
            <input
              type="number"
              min="0"
              max="100"
              value={autoCfg.auto_approve_cutoff ?? 80}
              onChange={(event) => updateAutomation("auto_approve_cutoff", event.target.value === "" ? null : parseFloat(event.target.value))}
              className="w-24 px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] font-bold text-[var(--text-secondary)]">%</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.forms.autoCutoffHint")}</p>
        </div>

        <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] pt-4">{t("platformMisc.forms.workflowSuccessMessage")}</h4>
        <p className="text-[10px] font-medium text-[var(--text-secondary)] mb-3">{t("platformMisc.forms.workflowSuccessHint")}</p>
        <textarea
          value={automationConfig?.success_message || DEFAULT_AUTOMATION.success_message || ""}
          onChange={(event) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), success_message: event.target.value })}
          rows={4}
          placeholder={t("platformMisc.forms.successMessagePlaceholder")}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-amber-500 resize-y font-mono"
        />
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.redirectAfterSubmitLabel")}</label>
          <input
            type="url"
            value={automationConfig?.redirect_after_submit || ""}
            onChange={(event) => setAutomationConfig({ ...(automationConfig || DEFAULT_AUTOMATION), redirect_after_submit: event.target.value })}
            placeholder="https://example.com/thank-you"
            className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-amber-500"
          />
        </div>
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.workflowPlaceholdersHint")}</p>

        <button
          onClick={() => setWorkflowConfig(null)}
          className="text-[10px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-wide"
        >
          {t("platformMisc.forms.workflowResetDefaults")}
        </button>
      </div>
    </div>
  );
}
