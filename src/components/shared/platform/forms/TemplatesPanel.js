import { Mail, X, Send, CheckCircle2, Key, LogIn, XCircle, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import ResultDelayEditor from "@/components/ui/ResultDelayEditor";
import { readResultDelayMinutes, TEMPLATE_VARIABLES } from "@/lib/constants";
import TemplateEditor from "./TemplateEditor";

export default function TemplatesPanel({ templateConfig, updateTemplate, onPersonalize, personalizing, onSave, saving, onClose }) {
  const { t } = useI18n();
  const templateData = templateConfig || {};
  return (
    <div className="px-6 py-4 bg-secondary border-b border-[var(--border-primary)] space-y-4 shrink-0 max-h-[50vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.forms.templatesTitle")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={saving}
            onClick={onSave}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-[10px] font-bold uppercase tracking-wide hover:bg-cyan-600 transition-all"
          >
            {t("platformMisc.forms.templatesSave")}
          </button>
          <button onClick={onClose}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
        </div>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
        {t("platformMisc.forms.templatesHintPrefix")} <code className="px-1 bg-tertiary rounded text-[var(--brand-orange)]">{`{{variable}}`}</code> {t("platformMisc.forms.templatesHintSuffix")}
      </p>

      <div className="space-y-3">
        <TemplateEditor
          label={t("platformMisc.forms.templateSubmissionLabel")} icon={Send}
          tKey="acknowledgement"
          desc={t("platformMisc.forms.templateSubmissionDesc")}
          defaultSubject={t("platformMisc.forms.templateSubmissionSubject")}
          defaultBody={t("platformMisc.forms.templateSubmissionBody")}
          vars={TEMPLATE_VARIABLES.acknowledgement}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />
        <TemplateEditor
          label={t("platformMisc.forms.templateApprovalLabel")} icon={CheckCircle2}
          tKey="approval"
          desc={t("platformMisc.forms.templateApprovalDesc")}
          defaultSubject={t("platformMisc.forms.templateApprovalSubject")}
          defaultBody={t("platformMisc.forms.templateApprovalBody")}
          vars={TEMPLATE_VARIABLES.approval}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />
        <TemplateEditor
          label={t("platformMisc.forms.templateActivationLabel")} icon={Key}
          tKey="activation"
          desc={t("platformMisc.forms.templateActivationDesc")}
          defaultSubject={t("platformMisc.forms.templateActivationSubject")}
          defaultBody={t("platformMisc.forms.templateActivationBody")}
          vars={TEMPLATE_VARIABLES.activation}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />
        <TemplateEditor
          label={t("platformMisc.forms.templateExistingUserLabel")} icon={LogIn}
          tKey="existing_user"
          desc={t("platformMisc.forms.templateExistingUserDesc")}
          defaultSubject={t("platformMisc.forms.templateExistingUserSubject")}
          defaultBody={t("platformMisc.forms.templateExistingUserBody")}
          vars={TEMPLATE_VARIABLES.existing_user}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />
        <TemplateEditor
          label={t("platformMisc.forms.templateRejectionLabel")} icon={XCircle}
          tKey="rejection"
          desc={t("platformMisc.forms.templateRejectionDesc")}
          defaultSubject={t("platformMisc.forms.templateRejectionSubject")}
          defaultBody={t("platformMisc.forms.templateRejectionBody")}
          vars={TEMPLATE_VARIABLES.rejection}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />
        <TemplateEditor
          label={t("platformMisc.forms.templateResultLabel")} icon={FileText}
          tKey="result"
          desc={t("platformMisc.forms.templateResultDesc")}
          defaultSubject={t("platformMisc.forms.templateResultSubject")}
          defaultBody={t("platformMisc.forms.templateResultBody")}
          vars={TEMPLATE_VARIABLES.result}
          onPersonalize={onPersonalize}
          personalizingKey={personalizing}
          templates={templateData}
          onChange={updateTemplate}
        />

        {/* The result message can also be timed: the delay lives with the
            template it belongs to, and a run may override it. */}
        <ResultDelayEditor
          title={t("platformMisc.forms.templateResultDelayTitle")}
          description={t("platformMisc.forms.templateResultDelayDesc")}
          hoursLabel={t("platformMisc.forms.templateResultDelayUnitHours")}
          minutesLabel={t("platformMisc.forms.templateResultDelayUnitMinutes")}
          afterLabel={t("platformMisc.forms.templateResultDelayAfterSubmission")}
          footnote={t("platformMisc.forms.templateResultDelayHint")}
          value={readResultDelayMinutes(templateData.result) ?? 0}
          onChange={(minutes) => updateTemplate("result", "delay_minutes", minutes)}
        />
      </div>
    </div>
  );
}
