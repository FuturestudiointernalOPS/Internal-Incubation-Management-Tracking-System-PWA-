import { Send, CheckCircle2, Key, LogIn, XCircle, FileText, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ResultDelayEditor from "@/components/ui/ResultDelayEditor";
import { findUnknownTemplateVariables, readResultDelayMinutes, TEMPLATE_VARIABLES } from "@/lib/constants";
import { formatDelayLabel } from "./helpers";

/**
 * One email template override for a run.
 *
 * Defined at MODULE scope, not inside the tab: a component created during a
 * render is a new type every time, so React unmounts and remounts its inputs on
 * every keystroke — the field loses focus after each letter and the author can
 * never finish a sentence. Nothing here depends on render-local state, so
 * hoisting it costs nothing and typing works.
 */
function RunTemplateEditor({ tKey, label, icon: Icon, desc, vars, current, onChange, onPersonalize, personalizing }) {
  const { t } = useI18n();
  // Names the sender will not fill in — it removes them, so the author is told
  // before sending rather than discovering it in the sent mail.
  const unknownVariables = findUnknownTemplateVariables(
    `${current?.subject || ""} ${current?.body || ""}`,
    vars || [],
  );
  return (
    <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">{label}</p>
        <button
          type="button"
          disabled={personalizing === tKey}
          onClick={() => onPersonalize(tKey, label)}
          className="ml-auto px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1"
        >
          <Sparkles className="w-2.5 h-2.5" />
          {personalizing === tKey ? t("platformMisc.forms.templateWriting") : t("platformMisc.forms.templatePersonalize")}
        </button>
      </div>
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{desc}</p>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateSubject")}</label>
        <input
          value={current?.subject || ""}
          onChange={(event) => onChange(tKey, "subject", event.target.value)}
          placeholder={t("platformMisc.runs.runTemplateEmptyHint")}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateBody")}</label>
        <textarea
          value={current?.body || ""}
          onChange={(event) => onChange(tKey, "body", event.target.value)}
          rows={4}
          placeholder={t("platformMisc.runs.runTemplateEmptyHint")}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
        />
      </div>
      {vars && (
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.templateVariables", { vars: vars.join(", ") })}</p>
      )}
      {unknownVariables.length > 0 && (
        <p className="text-[10px] font-bold text-amber-500">
          {t("platformMisc.forms.templateUnknownVariables", { vars: unknownVariables.join(", ") })}
        </p>
      )}
    </div>
  );
}

export default function TemplatesTab({
  selectedRun, setSelectedRun, runSettings, setRunSettings,
  runTemplates, setRunTemplates, runTplSaving, setRunTplSaving,
  runFormSettings, runPersonalizing, setRunPersonalizing, notify,
}) {
  const { t } = useI18n();

  const updateRunTemplate = (key, field, value) => {
    setRunTemplates((prev) => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (!next[key]) next[key] = {};
      next[key][field] = value;
      return next;
    });
  };

  const saveRunTemplates = async () => {
    if (!selectedRun) return;
    setRunTplSaving(true);
    try {
      // Never persist empty template shells: an entry whose subject AND
      // body are both blank must fall through to the form template, not
      // shadow it at send time.
      const cleanedTemplates = Object.fromEntries(
        Object.entries(runTemplates || {}).filter(([, template]) => {
          const subject = (template?.subject || "").trim();
          const body = (template?.body || "").trim();
          // A delay is a setting in its own right: an entry that only
          // schedules the send must survive, or the run would silently
          // fall back to the form's delay.
          return subject || body || readResultDelayMinutes(template) !== null;
        })
      );
      const response = await fetch("/api/platform/form-runs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRun.id, settings: { ...(runSettings || {}), templates: cleanedTemplates } }),
      });
      const data = await response.json();
      if (data.success) {
        setRunSettings(data.run.settings || {});
        setSelectedRun({ ...selectedRun, settings: data.run.settings });
        notify(t("platformMisc.runs.runTemplatesSaved"));
      } else {
        notify(data.error || t("platformMisc.runs.runTemplatesSaveFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.runTemplatesSaveNetworkError"));
    }
    setRunTplSaving(false);
  };

  const personalizeRunTemplate = async (templateKey, label) => {
    if (runPersonalizing) return;
    setRunPersonalizing(templateKey);
    try {
      // Draft base: run-level draft first; when the run draft is empty,
      // personalize the form-level template (never the platform default
      // alone) so a designed template is improved, not replaced.
      const formTemplate = runFormSettings?.automation?.templates?.[templateKey] || {};
      const baseSubject = (runTemplates[templateKey]?.subject || "").trim() || (formTemplate.subject || "").trim();
      const baseBody = (runTemplates[templateKey]?.body || "").trim() || (formTemplate.body || "").trim();
      const response = await fetch("/api/platform/ai/personalize-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey,
          form_name: selectedRun?.name || "",
          organization: "Future Studio",
          existing_subject: baseSubject,
          existing_body: baseBody,
        }),
      });
      const data = await response.json();
      if (data.success) {
        updateRunTemplate(templateKey, "subject", data.subject);
        updateRunTemplate(templateKey, "body", data.body);
        notify(t("platformMisc.forms.templatePersonalized", { label }));
      } else {
        notify(data.error || t("platformMisc.forms.templatePersonalizeFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.forms.templatePersonalizeNetworkError"));
    }
    setRunPersonalizing(null);
  };

  // One canonical number of MINUTES for this run's result delay; the
  // legacy hours field is dropped so the entry can never mean two
  // things at once.
  const setRunResultDelay = (minutes) => {
    setRunTemplates((prev) => {
      const next = JSON.parse(JSON.stringify(prev || {}));
      if (!next.result) next.result = {};
      next.result.delay_minutes = minutes;
      delete next.result.delay_hours;
      return next;
    });
  };

  // What is actually in force for this run (its own value, else the
  // form's), and where it comes from — the control shows the effective
  // value so the switch is never off while a delay is being applied.
  const runDelaySet = readResultDelayMinutes(runTemplates?.result) !== null;
  const runDelayValue = readResultDelayMinutes(runTemplates?.result);
  const formDelayValue = readResultDelayMinutes(runFormSettings?.automation?.templates?.result) ?? 0;
  const effectiveRunDelay = runDelayValue !== null ? runDelayValue : formDelayValue;
  const runDelayFootnote = effectiveRunDelay <= 0
    ? t("platformMisc.runs.resultDelayManual")
    : t("platformMisc.runs.resultDelayEffective", {
        duration: formatDelayLabel(t, effectiveRunDelay),
        source: runDelaySet
          ? t("platformMisc.runs.resultDelaySourceRun")
          : t("platformMisc.runs.resultDelaySourceForm"),
      });

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.runTemplatesTitle")}</h3>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.runTemplatesDesc")}</p>
        </div>
        <button onClick={saveRunTemplates} disabled={runTplSaving} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-40">
          {runTplSaving ? t("platformMisc.runs.saving") : t("platformMisc.forms.templatesSave")}
        </button>
      </div>

      <div className="space-y-3">
        <RunTemplateEditor
          tKey="acknowledgement"
          label={t("platformMisc.forms.templateSubmissionLabel")}
          icon={Send}
          desc={t("platformMisc.runs.runTemplateAcknowledgementDesc")}
          vars={TEMPLATE_VARIABLES.acknowledgement}
          current={runTemplates.acknowledgement || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <RunTemplateEditor
          tKey="approval"
          label={t("platformMisc.forms.templateApprovalLabel")}
          icon={CheckCircle2}
          desc={t("platformMisc.runs.runTemplateApprovalDesc")}
          vars={TEMPLATE_VARIABLES.approval}
          current={runTemplates.approval || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <RunTemplateEditor
          tKey="activation"
          label={t("platformMisc.forms.templateActivationLabel")}
          icon={Key}
          desc={t("platformMisc.runs.runTemplateActivationDesc")}
          vars={TEMPLATE_VARIABLES.activation}
          current={runTemplates.activation || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <RunTemplateEditor
          tKey="existing_user"
          label={t("platformMisc.forms.templateExistingUserLabel")}
          icon={LogIn}
          desc={t("platformMisc.runs.runTemplateExistingUserDesc")}
          vars={TEMPLATE_VARIABLES.existing_user}
          current={runTemplates.existing_user || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <RunTemplateEditor
          tKey="rejection"
          label={t("platformMisc.forms.templateRejectionLabel")}
          icon={XCircle}
          desc={t("platformMisc.runs.runTemplateRejectionDesc")}
          vars={TEMPLATE_VARIABLES.rejection}
          current={runTemplates.rejection || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <RunTemplateEditor
          tKey="result"
          label={t("platformMisc.forms.templateResultLabel")}
          icon={FileText}
          desc={t("platformMisc.runs.runTemplateResultDesc")}
          vars={TEMPLATE_VARIABLES.result}
          current={runTemplates.result || {}}
          onChange={updateRunTemplate}
          onPersonalize={personalizeRunTemplate}
          personalizing={runPersonalizing}
        />
        <ResultDelayEditor
          title={t("platformMisc.runs.resultDelayTitle")}
          description={t("platformMisc.runs.resultDelayDesc")}
          hoursLabel={t("platformMisc.runs.resultDelayUnitHours")}
          minutesLabel={t("platformMisc.runs.resultDelayUnitMinutes")}
          afterLabel={t("platformMisc.runs.resultDelayAfterSubmission")}
          footnote={runDelayFootnote}
          value={effectiveRunDelay}
          onChange={setRunResultDelay}
        />
      </div>
    </div>
  );
}
