"use client";

import { CheckCircle2, FileText, Layers } from "lucide-react";
import { activityLabel } from "@/lib/ventureActivity";

/**
 * The "startup profile wizard" tab of the admin venture detail screen.
 *
 * Extracted verbatim from `VentureDetailView.js` — see docs/LAYER_SPLIT.md. The
 * view keeps the `ctx` destructure (pinned by the venture-detail wiring test);
 * this component receives the values it needs as props.
 */
export default function VentureWizardTab({ t, venture, id, router, lang, wizardSteps }) {
  return (
    <div className="space-y-6">
      {/* Link to Full Wizard */}
      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <Layers className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.detail.startupProfileWizard")}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {t("vadmin.detail.wizardDescription")}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/ventures/${id}/wizard`)}
            className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
          >
            <Layers className="w-3.5 h-3.5" /> {t("vadmin.detail.openWizard")}
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-purple-500" />
          {t("vadmin.detail.progressOverview")}
        </h3>
        <div className="space-y-3">
          {wizardSteps.map((ws) => {
            const completed = (venture.history || []).some(
              (historyEntry) => historyEntry.event_type === "PROFILE_WIZARD_INIT" && historyEntry.metadata?.step === ws.step && historyEntry.metadata?.completed
            );
            const Icon = ws.icon;
            return (
              <div
                key={ws.step}
                className={`flex items-center gap-4 p-3 rounded-xl ${
                  completed ? "bg-emerald-500/[0.03] border border-emerald-500/10" : "bg-tertiary border border-[var(--border-primary)]"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  completed ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                }`}>
                  {completed ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-[11px] font-bold ${
                    completed ? "text-emerald-500" : "text-slate-500"
                  }`}>
                    {t("vadmin.detail.stepName", { step: ws.step, name: t(ws.name) })}
                  </p>
                </div>
                {completed && (
                  <span className="text-[8px] font-black text-emerald-500 uppercase">{t("vadmin.detail.completed")}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard History */}
      <div className="card">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-purple-500" />
          {t("vadmin.detail.wizardHistory")}
        </h3>
        {(venture.history || []).length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t("vadmin.detail.noWizardHistory")}</p>
        ) : (
          <div className="space-y-2">
            {(venture.history || []).map((entry, index) => (
              <div key={entry.id || index} className="flex items-start gap-4 p-3 rounded-lg bg-tertiary border border-[var(--border-primary)]">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-[var(--text-primary)]">{activityLabel(entry.event_type, t)}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{entry.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] text-slate-600">
                      {new Date(entry.created_at).toLocaleString(lang)}
                    </span>
                    {entry.metadata?.step && (
                      <span className="text-[8px] font-bold text-purple-500">
                        {t("vadmin.detail.stepFraction", { step: entry.metadata.step, total: entry.metadata.total_steps })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
