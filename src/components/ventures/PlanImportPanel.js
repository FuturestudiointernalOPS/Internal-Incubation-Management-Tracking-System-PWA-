"use client";

import React, { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Flag,
  HelpCircle,
  Loader2,
  Package,
  Upload,
  UserX,
} from "lucide-react";
import { planSheetKind, MAX_PLAN_UPLOAD_BYTES } from "@/lib/venturePlanSheetRules";

/**
 * PlanImportPanel — Phase 1 of the programme import: read a tracker, ask for a
 * proposal, show the proposal.
 *
 * NOTHING HERE CREATES ANYTHING, and the panel says so on screen. The tracker
 * is an INPUT, never the source of truth: the analyst maps it into the platform
 * hierarchy (Journey → Milestone → Task → Deliverable), the server checks the
 * answer against the platform's own people and references, and what comes back
 * is a PROPOSAL the reviewer decides on. Applying it is the next step — so this
 * panel ends exactly where the decision begins instead of implying work is done.
 *
 * The format/size rules come from lib/venturePlanSheetRules, the same ones the
 * route applies: the form cannot offer a file the server would refuse.
 */
export default function PlanImportPanel({ ventureId }) {
  const { t, lang } = useI18n();
  const fileInput = useRef(null);

  const [file, setFile] = useState(null);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const pick = (chosen) => {
    setError(null);
    setResult(null);
    if (!chosen) {
      setFile(null);
      return;
    }
    if (!planSheetKind({ name: chosen.name, mime: chosen.type })) {
      setFile(null);
      setError(t("venture.planImport.badType"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (chosen.size > MAX_PLAN_UPLOAD_BYTES) {
      setFile(null);
      setError(t("venture.planImport.tooLarge"));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(chosen);
  };

  const analyse = async () => {
    if (!file) {
      setError(t("venture.planImport.noFile"));
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (context.trim()) formData.append("context", context.trim());

      const res = await fetch(`/api/ventures/${ventureId}/plan-import`, { method: "POST", body: formData });
      const payload = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setError(t("venture.planImport.notAllowed"));
        return;
      }
      if (!res.ok || !payload.success) {
        setError(payload.error || t("venture.planImport.failed"));
        return;
      }
      setResult(payload);
    } catch (_) {
      setError(t("venture.planImport.failed"));
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang) : "—");

  const stats = result?.proposal?.stats || {};

  return (
    <div className="card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.planImport.title")}
        </h3>
        {result && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setFile(null);
              setContext("");
              if (fileInput.current) fileInput.current.value = "";
            }}
            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"
          >
            {t("venture.planImport.startOver")}
          </button>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.planImport.intro")}</p>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!result && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.file")}</label>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              onChange={(event) => pick(event.target.files?.[0] || null)}
              className="w-full text-[11px] text-slate-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
            />
            <p className="text-[9px] text-slate-500">{t("venture.planImport.fileHint")}</p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.planImport.context")}</label>
            <textarea
              value={context}
              onChange={(event) => setContext(event.target.value)}
              rows={2}
              placeholder={t("venture.planImport.contextPlaceholder")}
              className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={analyse}
              disabled={busy || !file}
              className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {t(busy ? "venture.planImport.analysing" : "venture.planImport.analyse")}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* The single most important line on this panel. */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-300">{t("venture.planImport.nothingCreated")}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <span className="px-2 py-1 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)]">
              {t("venture.planImport.statJourneys", { n: stats.journeys || 0 })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
              {t("venture.planImport.statMilestones", { n: stats.milestones || 0 })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
              {t("venture.planImport.statTasks", { n: stats.tasks || 0 })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/5 text-[var(--text-secondary)]">
              {t("venture.planImport.statDeliverables", { n: stats.deliverables || 0 })}
            </span>
            <span className="px-2 py-1 rounded-lg bg-white/5 text-slate-400 normal-case tracking-normal">
              {t("venture.planImport.sheetsRead", {
                n: (result.sheets || []).length,
                names: (result.sheets || []).map((sheet) => sheet.name).join(", "),
              })}
            </span>
          </div>

          {result.truncated && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t("venture.planImport.truncated")}
            </p>
          )}

          {result.proposal?.journeys?.map((journey, journeyIndex) => (
            <div key={`${journey.name}-${journeyIndex}`} className="rounded-xl border border-[var(--border-primary)] p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Compass className="w-4 h-4 shrink-0 mt-0.5 text-[var(--brand-orange)]" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-[var(--text-primary)]">{journey.name}</p>
                  {journey.objective && <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{journey.objective}</p>}
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 mt-1">
                    {t("venture.planImport.journeyDates", {
                      start: fmtDate(journey.start_date),
                      target: fmtDate(journey.target_date),
                    })}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pl-6">
                {(journey.milestones || []).map((milestone, milestoneIndex) => (
                  <div key={`${milestone.name}-${milestoneIndex}`} className="rounded-lg border border-divider/60 p-2.5">
                    <div className="flex items-start gap-2">
                      <Flag className="w-3.5 h-3.5 shrink-0 mt-0.5 text-sky-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[12px] font-bold text-[var(--text-primary)]">{milestone.name}</p>
                          {milestone.ref && (
                            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                              {milestone.ref}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">{fmtDate(milestone.target_date)}</span>
                        </div>
                        {milestone.objective && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{milestone.objective}</p>}

                        <ul className="mt-1.5 space-y-1">
                          {(milestone.tasks || []).map((task, taskIndex) => (
                            <li key={`${task.title}-${taskIndex}`} className="text-[11px]">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                {task.ref && <span className="text-[8px] font-black text-slate-500">{task.ref}</span>}
                                <span className="text-[var(--text-primary)]">{task.title}</span>
                                {task.owner_name ? (
                                  task.owner_cid ? (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                                      {task.owner_name}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                                      {task.owner_name}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">
                                    {t("venture.planImport.unassigned")}
                                  </span>
                                )}
                                {task.due_date && <span className="text-[9px] text-slate-500">{fmtDate(task.due_date)}</span>}
                                {(task.depends_on || []).length > 0 && (
                                  <span className="text-[8px] uppercase tracking-widest text-slate-500">
                                    {t("venture.planImport.dependsOn", { refs: task.depends_on.join(", ") })}
                                  </span>
                                )}
                              </div>
                              {(task.deliverables || []).length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 pl-1">
                                  <Package className="w-3 h-3 text-slate-500 shrink-0" />
                                  {(task.deliverables || []).map((deliverable, deliverableIndex) => (
                                    <span
                                      key={`${deliverable.title}-${deliverableIndex}`}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-secondary)]"
                                    >
                                      {deliverable.title}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {(result.unmatched_owners || []).length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5 mb-1.5">
                <UserX className="w-3.5 h-3.5" /> {t("venture.planImport.unmatchedOwners")}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {result.unmatched_owners.map((name) => (
                  <span key={name} className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-[var(--text-primary)]">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">{t("venture.planImport.unmatchedOwnersHint")}</p>
            </div>
          )}

          {(result.proposal?.unplaced || []).length > 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                {t("venture.planImport.unplaced")}
              </p>
              <ul className="space-y-1">
                {result.proposal.unplaced.map((item, index) => (
                  <li key={`${item.location}-${index}`} className="text-[10px] text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--text-primary)]">{item.location}</span> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(result.warnings || []).length > 0 && (
            <div className="rounded-xl border border-[var(--border-primary)] p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                {t("venture.planImport.warnings")}
              </p>
              <ul className="space-y-1">
                {result.warnings.map((warning, index) => (
                  <li key={index} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            {t("venture.planImport.nextStep")}
          </p>
        </div>
      )}
    </div>
  );
}
