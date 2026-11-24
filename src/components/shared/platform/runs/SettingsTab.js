import {
  Hash, Send, EyeOff, StopCircle, MessageSquare, Info, Sparkles, Paperclip,
  ExternalLink, FileText, Trash2, Loader2, Upload, Clock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { RUN_AUTOMATION_FLAGS, REPORT_FILE_ACCEPT } from "./constants";
import { cn, formatFileSize, formatDelayLabel } from "./helpers";
import { SettingRow, Toggle } from "./SettingRow";
import { readResultDelayMinutes } from "@/lib/constants";

export default function SettingsTab({
  selectedRun, editingSettings, setEditingSettings,
  runSettings, setRunSettings, saving, handleSaveSettings,
  reportFile, reportFileBusy, reportFileText, reportFileTextOpen,
  openReportFile, toggleReportFileText, removeReportFile, uploadReportFile,
  runFormSettings, runAutomationValue, isRunAutomationOverride, setRunAutomationFlag, resetRunAutomation,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runs.runConfiguration")}</h3>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.runConfigurationDesc")}</p>
        </div>
        {!editingSettings ? (
          <button onClick={() => setEditingSettings(true)} className="px-3 py-2 rounded-xl bg-brand-orange/10 text-[var(--brand-orange)] text-[10px] font-bold uppercase tracking-wide hover:bg-brand-orange/20">{t("platformMisc.runs.edit")}</button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditingSettings(false); setRunSettings(selectedRun.settings || {}); }} className="px-3 py-2 rounded-xl bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide">{t("platformMisc.runs.cancel")}</button>
            <button onClick={handleSaveSettings} disabled={saving} className="px-3 py-2 rounded-xl bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">{saving ? t("platformMisc.runs.saving") : t("platformMisc.runs.save")}</button>
          </div>
        )}
      </div>

      <div className="space-y-4 bg-secondary border border-[var(--border-primary)] rounded-2xl p-5">
        {/* Submission Limits */}
        <SettingRow label={t("platformMisc.runs.settingSubmissionLimit")} icon={Hash} desc={t("platformMisc.runs.settingSubmissionLimitDesc")}>
          {editingSettings ? (
            <input type="number" min="0" value={runSettings.submission_limit ?? 0} onChange={(event) => setRunSettings({ ...runSettings, submission_limit: parseInt(event.target.value) || 0 })} className="w-24 rounded-xl px-3 py-2 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)]" />
          ) : (
            <span className="text-[11px] font-bold text-[var(--text-primary)]">{(runSettings.submission_limit || 0) === 0 ? t("platformMisc.runs.unlimited") : runSettings.submission_limit}</span>
          )}
        </SettingRow>

        {/* Multiple Submissions */}
        <SettingRow label={t("platformMisc.runs.settingMultipleSubmissions")} icon={Send} desc={t("platformMisc.runs.settingMultipleSubmissionsDesc")}>
          {editingSettings ? (
            <Toggle checked={!!runSettings.allow_multiple} onChange={(enabled) => setRunSettings({ ...runSettings, allow_multiple: enabled })} />
          ) : (
            <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", runSettings.allow_multiple ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.allow_multiple ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
          )}
        </SettingRow>

        {/* Anonymous Submissions */}
        <SettingRow label={t("platformMisc.runs.settingAnonymousSubmissions")} icon={EyeOff} desc={t("platformMisc.runs.settingAnonymousSubmissionsDesc")}>
          {editingSettings ? (
            <Toggle checked={!!runSettings.anonymous} onChange={(enabled) => setRunSettings({ ...runSettings, anonymous: enabled })} />
          ) : (
            <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", runSettings.anonymous ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.anonymous ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
          )}
        </SettingRow>

        {/* Auto-close */}
        <SettingRow label={t("platformMisc.runs.settingAutoClose")} icon={StopCircle} desc={t("platformMisc.runs.settingAutoCloseDesc")}>
          {editingSettings ? (
            <Toggle checked={!!runSettings.auto_close} onChange={(enabled) => setRunSettings({ ...runSettings, auto_close: enabled })} />
          ) : (
            <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", runSettings.auto_close ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{runSettings.auto_close ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
          )}
        </SettingRow>

        {/* Confirmation Message */}
        <SettingRow label={t("platformMisc.runs.settingConfirmationMessage")} icon={MessageSquare} desc={t("platformMisc.runs.settingConfirmationMessageDesc")}>
          {editingSettings ? (
            <textarea value={runSettings.confirmation_message || ""} onChange={(event) => setRunSettings({ ...runSettings, confirmation_message: event.target.value })} rows={2} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.confirmationMessagePlaceholder")} />
          ) : (
            <span className="text-[10px] font-medium text-[var(--text-secondary)]">{runSettings.confirmation_message || "—"}</span>
          )}
        </SettingRow>

        {/* Instructions */}
        <SettingRow label={t("platformMisc.runs.settingSubmissionInstructions")} icon={Info} desc={t("platformMisc.runs.settingSubmissionInstructionsDesc")}>
          {editingSettings ? (
            <textarea value={runSettings.instructions || ""} onChange={(event) => setRunSettings({ ...runSettings, instructions: event.target.value })} rows={3} className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-none" placeholder={t("platformMisc.runs.instructionsPlaceholder")} />
          ) : (
            <span className="text-[10px] font-medium text-[var(--text-secondary)] whitespace-pre-wrap">{runSettings.instructions || "—"}</span>
          )}
        </SettingRow>

        {/* Output Instructions — optional AI instruction for this run's report */}
        <SettingRow label={t("platformMisc.runs.settingOutputInstruction")} icon={Sparkles} desc={t("platformMisc.runs.settingOutputInstructionDesc")}>
          {editingSettings ? (
            <div className="space-y-1 w-full">
              <textarea
                value={runSettings.output_instruction || ""}
                onChange={(event) => setRunSettings({ ...runSettings, output_instruction: event.target.value })}
                rows={6}
                maxLength={4000}
                className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] resize-y"
                placeholder={t("platformMisc.runs.outputInstructionPlaceholder")}
              />
              <p className="text-[9px] font-medium text-[var(--text-secondary)] text-right">
                {t("platformMisc.runs.outputInstructionCount", { count: (runSettings.output_instruction || "").length, max: 4000 })}
              </p>
            </div>
          ) : (
            <span className="text-[10px] font-medium text-[var(--text-secondary)] whitespace-pre-wrap">
              {(runSettings.output_instruction || "").trim() || t("platformMisc.runs.outputInstructionNone")}
            </span>
          )}
        </SettingRow>

        {/* Reference document — the file half of the report brief */}
        <SettingRow label={t("platformMisc.runs.settingReportFile")} icon={Paperclip} desc={t("platformMisc.runs.settingReportFileDesc")}>
          <div className="space-y-3 w-full">
            {reportFile ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] break-all">{reportFile.file_name}</span>
                  {formatFileSize(reportFile.file_size) && (
                    <span className="text-[10px] font-medium text-[var(--text-secondary)]">{formatFileSize(reportFile.file_size)}</span>
                  )}
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                    reportFile.extraction_status === "ok" ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10",
                  )}>
                    {reportFile.extraction_status === "ok"
                      ? t("platformMisc.runs.reportFileStatusReadable")
                      : reportFile.extraction_status === "empty"
                        ? t("platformMisc.runs.reportFileStatusEmpty")
                        : t("platformMisc.runs.reportFileStatusFailed")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={openReportFile} className="px-3 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5">
                    <ExternalLink className="w-3 h-3" /> {t("platformMisc.runs.reportFileOpen")}
                  </button>
                  {reportFile.text_length > 0 && (
                    <button onClick={toggleReportFileText} className="px-3 py-1.5 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5">
                      <FileText className="w-3 h-3" />
                      {reportFileTextOpen ? t("platformMisc.runs.reportFileTextHide") : t("platformMisc.runs.reportFileTextShow")}
                    </button>
                  )}
                  {editingSettings && (
                    <button onClick={removeReportFile} disabled={reportFileBusy} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 flex items-center gap-1.5">
                      <Trash2 className="w-3 h-3" /> {t("platformMisc.runs.reportFileRemove")}
                    </button>
                  )}
                </div>
                {reportFileTextOpen && (
                  <div className="rounded-xl border border-[var(--border-primary)] bg-primary/50 p-3 space-y-2">
                    {reportFileText?.loading ? (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> {t("platformMisc.runs.reportFileTextLoading")}
                      </p>
                    ) : reportFileText?.error ? (
                      <p className="text-[10px] font-medium text-amber-500">{t("platformMisc.runs.reportFileTextFailed")}</p>
                    ) : (
                      <>
                        {!!reportFileText?.prompt_limit && (reportFileText?.text || "").length > reportFileText.prompt_limit && (
                          <p className="text-[10px] font-medium text-amber-500">
                            {t("platformMisc.runs.reportFileTextPartial", { count: reportFileText.prompt_limit })}
                          </p>
                        )}
                        <pre className="max-h-64 overflow-y-auto text-[10px] font-medium whitespace-pre-wrap text-[var(--text-primary)]">{reportFileText?.text || ""}</pre>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <span className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runs.reportFileNone")}</span>
            )}

            {editingSettings && (
              <label className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                reportFileBusy
                  ? "opacity-60 cursor-wait bg-tertiary text-[var(--text-secondary)]"
                  : "cursor-pointer bg-brand-orange/10 text-[var(--brand-orange)] hover:bg-brand-orange/20",
              )}>
                {reportFileBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {reportFileBusy
                  ? t("platformMisc.runs.reportFileReading")
                  : reportFile
                    ? t("platformMisc.runs.reportFileReplace")
                    : t("platformMisc.runs.reportFileChoose")}
                <input
                  type="file"
                  accept={REPORT_FILE_ACCEPT}
                  className="hidden"
                  disabled={reportFileBusy}
                  onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) uploadReportFile(file); }}
                />
              </label>
            )}
          </div>
        </SettingRow>

        {/* Automation — which applicant emails this run sends */}
        <SettingRow label={t("platformMisc.runs.automationTitle")} icon={Sparkles} desc={t("platformMisc.runs.automationDesc")}>
          {editingSettings ? (
            <button onClick={resetRunAutomation} className="px-3 py-2 rounded-xl bg-tertiary text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wide hover:text-[var(--text-primary)]">{t("platformMisc.runs.automationUseForm")}</button>
          ) : null}
        </SettingRow>

        {RUN_AUTOMATION_FLAGS.map(({ section, flag, icon: Icon, label }) => {
          const effective = runAutomationValue(section, flag);
          const fromForm = !isRunAutomationOverride(section, flag) && typeof runFormSettings?.automation?.[section]?.[flag] === "boolean";
          return (
            <SettingRow key={`${section}.${flag}`} label={t(label)} icon={Icon}>
              <div className="flex items-center gap-2">
                {fromForm && <span className="text-[9px] font-medium text-[var(--text-secondary)]">{t("platformMisc.runs.automationFromForm")}</span>}
                {editingSettings ? (
                  <Toggle checked={effective} onChange={(enabled) => setRunAutomationFlag(section, flag, enabled)} />
                ) : (
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded", effective ? "text-emerald-500 bg-emerald-500/10" : "text-slate-500 bg-slate-500/10")}>{effective ? t("platformMisc.runs.yes") : t("platformMisc.runs.no")}</span>
                )}
              </div>
            </SettingRow>
          );
        })}

        {/* Scheduled result send — set with the result template, shown here
            so the timing is visible without opening the editor. */}
        <SettingRow label={t("platformMisc.runs.resultDelayTitle")} icon={Clock} desc={t("platformMisc.runs.resultDelaySettingsDesc")}>
          <span className="text-[11px] font-bold text-[var(--text-primary)]">
            {(() => {
              const runDelay = readResultDelayMinutes(runSettings?.templates?.result);
              const formDelay = readResultDelayMinutes(runFormSettings?.automation?.templates?.result) ?? 0;
              const effectiveDelay = runDelay !== null ? runDelay : formDelay;
              return effectiveDelay > 0
                ? t("platformMisc.runs.resultDelayValue", { duration: formatDelayLabel(t, effectiveDelay) })
                : t("platformMisc.runs.resultDelayManual");
            })()}
          </span>
        </SettingRow>
      </div>
    </div>
  );
}
