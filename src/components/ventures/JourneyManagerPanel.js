"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Route,
  Plus,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Trash2,
  Save,
  Copy,
  CopyPlus,
  CheckCircle2,
  AlertTriangle,
  Square,
  CheckSquare,
  Archive,
  RotateCcw,
  Pencil,
  Lock,
  Play,
  StickyNote,
} from "lucide-react";
import ScopedNotes from "@/components/ventures/ScopedNotes";

/**
 * JourneyManagerPanel — staff instrument for a Venture's Journey.
 *
 * The Journey is Venture-facing but staff-defined: authorized staff (Lead
 * Manager / Facilitator / others with operating_plan capabilities on this
 * Venture) configure the stages that this Venture actually needs. Nothing is
 * hardcoded — stage name, description, objective, target date, order and
 * status are all configurable, and the journey can be generated from a
 * reusable operating-plan template (structure only).
 *
 * Server-enforced: read through the journey API; every write checks the
 * global permission matrix (`operating_plan` area) + venture-wide assignment.
 * Members only ever see the published stages on their own Journey tab.
 */
export default function JourneyManagerPanel({ ventureId }) {
  const { t, lang } = useI18n();
  const [stages, setStages] = useState([]);
  const [access, setAccess] = useState({ create: false, edit: false, manage: false });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", objective: "", target_date: "" });
  const [saving, setSaving] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [tplSel, setTplSel] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [dupBusy, setDupBusy] = useState(null);
  const [notesStageId, setNotesStageId] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: "", description: "" });
  const [savingSave, setSavingSave] = useState(false);
  const [journeyTemplates, setJourneyTemplates] = useState([]);
  const [templateSource, setTemplateSource] = useState(null);
  // Journey archive/delete: selection + archived view + busy flag.
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedStageIds, setSelectedStageIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  const load = async () => {
    try {
      // include_archived=1: management surfaces render archived journeys in
      // their own view (the Venture never sees them).
      const res = await fetch(`/api/ventures/${ventureId}/journey?include_archived=1`);
      const d = await res.json();
      if (d.success) {
        setStages(d.stages || []);
        setAccess(d.access || {});
        setTemplateSource(d.template_source || null);
      }
    } catch (e) {
      console.error("Failed to load journey:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ventureId) load();
  }, [ventureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/venture-plan-templates`);
      const d = await res.json();
      if (d.success) setTemplates(d.templates || []);
    } catch (e) {
      console.error("Failed to load plan templates:", e);
    }
    try {
      const jres = await fetch(`/api/journey-templates`);
      const jd = await jres.json();
      if (jd.success) setJourneyTemplates(jd.templates || []);
    } catch (e) {
      console.error("Failed to load journey templates:", e);
    }
  };

  const toggleApply = async () => {
    const next = !applyOpen;
    setApplyOpen(next);
    if (next) await loadTemplates();
  };

  const addStage = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.stageAdded"));
        setForm({ name: "", description: "", objective: "", target_date: "" });
        setAddOpen(false);
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.addFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.manager.addFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  const patch = async (body) => {
    const res = await fetch(`/api/ventures/${ventureId}/journey`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.success) setStages(d.stages || []);
    else notify(d.error || t("venture.manager.actionFailed"), "error");
    return d.success;
  };

  // Duplicate a stage as an independent structure copy (milestones + tasks,
  // never submissions/reviews/history — those stay with the source).
  const duplicateStage = async (stage) => {
    if (!window.confirm(t("venture.manager.duplicateStageConfirm", { name: stage.name }))) return;
    setDupBusy(stage.id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stage.id }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.duplicateStageSuccess", { milestones: d.milestones_copied || 0, tasks: d.tasks_copied || 0 }));
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.duplicateStageFailed"), "error");
      }
    } catch (e) {
      notify(t("venture.manager.duplicateStageFailed"), "error");
    } finally {
      setDupBusy(null);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const ok = await patch({ action: "update", stage_id: editId, ...editForm });
    if (ok) {
      notify(t("venture.manager.stageUpdated"));
      setEditId(null);
      setEditForm({});
    }
  };

  const startEdit = (stage) => {
    setEditId(stage.id);
    setEditForm({
      name: stage.name || "",
      description: stage.description || "",
      objective: stage.objective || "",
      target_date: stage.target_date ? String(stage.target_date).slice(0, 10) : "",
    });
  };

  const applyTemplate = async () => {
    if (!tplSel) return;
    setSavingTpl(true);
    try {
      // Journey templates (structure incl. milestones/tasks) vs operating-plan
      // templates (stage structure only) — two libraries, one picker.
      const [kind, rawId] = String(tplSel).split(":");
      const isJourneyTpl = kind === "journey";
      const endpoint = isJourneyTpl
        ? `/api/ventures/${ventureId}/journey/apply-journey-template`
        : `/api/ventures/${ventureId}/journey/apply-template`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: rawId }),
      });
      const d = await res.json();
      if (d.success) {
        notify(isJourneyTpl ? t("venture.manager.journeyTemplateApplied") : t("venture.manager.journeyGeneratedPlan"));
        setApplyOpen(false);
        setTplSel("");
        setStages(d.stages || []);
      } else {
        notify(d.error || t("venture.manager.applyFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.manager.applyFailed"), "error");
    } finally {
      setSavingTpl(false);
    }
  };

  // Save this Venture's ENTIRE journey (stages + milestones + tasks) as a
  // reusable template in the ImpactOS library (structure only).
  const saveJourneyTemplate = async (e) => {
    e.preventDefault();
    setSavingSave(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/save-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveForm),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("venture.manager.saveTemplateSaved", { stages: d.stages || 0, milestones: d.milestones || 0, tasks: d.tasks || 0 }));
        setSaveOpen(false);
        setSaveForm({ name: "", description: "" });
      } else {
        notify(d.error || t("venture.manager.saveTemplateFailed"), "error");
      }
    } catch (err) {
      notify(t("venture.manager.saveTemplateFailed"), "error");
    } finally {
      setSavingSave(false);
    }
  };

  // ── Journey archive / permanent delete (double-confirmed) ────────────────
  const activeStages = stages.filter((s) => s.is_archived !== true);
  const archivedStages = stages.filter((s) => s.is_archived === true);
  const visibleStages = viewArchived ? archivedStages : activeStages;
  const allSelected =
    activeStages.length > 0 && activeStages.every((s) => selectedStageIds.has(String(s.id)));

  const toggleSelectStage = (id) => {
    const next = new Set(selectedStageIds);
    const key = String(id);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedStageIds(next);
  };
  const toggleSelectAllStages = () => {
    if (allSelected) setSelectedStageIds(new Set());
    else setSelectedStageIds(new Set(activeStages.map((s) => String(s.id))));
  };

  const runBulk = async ({ ids, action = "archive", endpoint }) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const d = await res.json();
      if (d.success) {
        const done =
          endpoint === "delete"
            ? d.deleted || []
            : action === "restore"
              ? d.restored || []
              : d.archived || [];
        const blocked = d.blocked || [];
        const parts = [];
        if (done.length) {
          parts.push(
            endpoint === "delete"
              ? t("venture.manager.journeysDeleted", { n: done.length })
              : action === "restore"
                ? t("venture.manager.journeysRestored", { n: done.length })
                : t("venture.manager.journeysArchived", { n: done.length }),
          );
        }
        if (blocked.length) parts.push(blocked[0]?.reason || t("venture.manager.journeysBlocked", { n: blocked.length }));
        notify(parts.join(" — ") || t("venture.manager.journeysArchived", { n: 0 }), blocked.length && !done.length ? "error" : "success");
        if (d.stages) setStages(d.stages);
      } else {
        notify(d.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    }
    setSelectedStageIds(new Set());
    setBulkBusy(false);
  };

  // Double confirmation: a second explicit "are you sure" is always required
  // for archiving or deleting journeys.
  const confirmTwice = (first, second) => window.confirm(first) && window.confirm(second);

  const selectedActiveIds = () =>
    activeStages.filter((s) => selectedStageIds.has(String(s.id))).map((s) => String(s.id));

  const archiveSelectedJourneys = () => {
    const ids = selectedActiveIds();
    if (!ids.length) return;
    if (!confirmTwice(
      t("venture.manager.archiveJourneysConfirm", { n: ids.length }),
      t("venture.manager.archiveJourneysConfirm2"),
    )) return;
    runBulk({ ids, action: "archive", endpoint: "archive" });
  };

  const deleteSelectedJourneys = () => {
    const ids = selectedActiveIds();
    if (!ids.length) return;
    if (!confirmTwice(
      t("venture.manager.deleteJourneysConfirm", { n: ids.length }),
      t("venture.manager.deleteJourneysConfirm2"),
    )) return;
    runBulk({ ids, endpoint: "delete" });
  };

  const archiveOneJourney = (stage) => {
    if (!confirmTwice(
      t("venture.manager.archiveJourneysConfirm", { n: 1 }),
      t("venture.manager.archiveJourneysConfirm2"),
    )) return;
    runBulk({ ids: [String(stage.id)], action: "archive", endpoint: "archive" });
  };
  const restoreOneJourney = (stage) => {
    if (!window.confirm(t("venture.manager.restoreJourneyConfirm", { name: stage.name }))) return;
    runBulk({ ids: [String(stage.id)], action: "restore", endpoint: "archive" });
  };
  const deleteOneJourney = (stage) => {
    if (!confirmTwice(
      t("venture.manager.deleteJourneysConfirm", { n: 1 }),
      t("venture.manager.deleteJourneysConfirm2"),
    )) return;
    runBulk({ ids: [String(stage.id)], endpoint: "delete" });
  };

  const stageStatusKey = (status) =>
    status === "completed"
      ? "vadmin.journey.statusCompleted"
      : status === "active"
        ? "vadmin.journey.statusActive"
        : "vadmin.journey.statusLocked";

  const stageNodeClass = (status) =>
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
      : status === "active"
        ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
        : "bg-slate-500/10 text-slate-400 border-[var(--border-primary)]";

  const milestoneStatusKey = (status) => {
    const known = ["locked", "not_started", "in_progress", "under_review", "changes_requested", "completed"];
    return known.includes(status)
      ? t(`venture.manager.milestoneStatuses.${status}`)
      : status ? status.replace(/_/g, " ") : "—";
  };

  const milestoneStatusClass = (status) =>
    status === "completed"
      ? "text-emerald-400 bg-emerald-500/10"
      : status === "in_progress"
        ? "text-sky-400 bg-sky-500/10"
        : status === "under_review"
          ? "text-amber-400 bg-amber-500/10"
          : status === "changes_requested"
            ? "text-rose-400 bg-rose-500/10"
            : "text-slate-400 bg-slate-500/10";

  const milestoneDotClass = (status) =>
    status === "completed"
      ? "bg-emerald-400"
      : status === "in_progress"
        ? "bg-sky-400"
        : status === "under_review"
          ? "bg-amber-400"
          : status === "changes_requested"
            ? "bg-rose-400"
            : "bg-slate-500";

  const statusPill = (stage) => {
    const cls =
      stage.status === "completed"
        ? "bg-emerald-500/10 text-emerald-400"
        : stage.status === "active"
          ? "bg-blue-500/10 text-blue-400"
          : "bg-slate-500/10 text-slate-400";
    return (
      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${cls}`}>{t(stageStatusKey(stage.status))}</span>
    );
  };

  const fmtDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(lang) : "");

  return (
    <div className="card">
      {/* Inline status message — never a floating top-right toast */}
      {toast && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${toast.type === "error" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
          {toast.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.manager.title")}
          <span className="px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]">{t("venture.manager.stagesCount", { count: activeStages.length })}</span>
        </h3>
        {access.create && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleApply}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              {applyOpen ? t("common.cancel") : t("venture.manager.fromTemplate")}
            </button>
            {access.manage && stages.length > 0 && (
              <button
                onClick={() => setSaveOpen(!saveOpen)}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--brand-orange)]/40 text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10 flex items-center gap-1.5"
              >
                <Save className="w-3 h-3" />
                {t("venture.manager.saveTemplate")}
              </button>
            )}
            <button
              onClick={() => setAddOpen(!addOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {addOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {addOpen ? t("common.cancel") : t("venture.manager.addStage")}
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.manager.intro")}</p>

      {templateSource && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[var(--brand-orange)]/25 bg-[var(--brand-orange)]/[0.04] px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            <Copy className="w-3.5 h-3.5" /> {t("venture.manager.sourceFrom")}
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">{templateSource.name || templateSource.id}</span>
          <span className="px-1.5 py-0.5 rounded bg-[var(--brand-orange)]/10 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            {t(templateSource.type === "journey" ? "venture.manager.sourceTypeJourney" : "venture.manager.sourceTypePlan")}
          </span>
        </div>
      )}

      {/* Journey archive toolbar: Active/Archived views, select all, bulk
          archive/delete (each with a double confirmation). */}
      {access.manage && stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={() => { setViewArchived(false); setSelectedStageIds(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${!viewArchived ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] border-[var(--brand-orange)]/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
          >
            {t("venture.manager.viewActiveJourneys", { n: activeStages.length })}
          </button>
          <button
            onClick={() => { setViewArchived(true); setSelectedStageIds(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${viewArchived ? "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] border-[var(--brand-orange)]/30" : "bg-tertiary border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"}`}
          >
            {t("venture.manager.viewArchivedJourneys", { n: archivedStages.length })}
          </button>
          {!viewArchived && activeStages.length > 0 && (
            <button
              onClick={toggleSelectAllStages}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[var(--text-primary)] border border-[var(--border-primary)] transition-all"
            >
              {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {t("venture.manager.selectAllJourneys")}
            </button>
          )}
          {!viewArchived && selectedStageIds.size > 0 && (
            <>
              <button
                onClick={archiveSelectedJourneys}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-40"
              >
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                {t("venture.manager.archiveSelectedJourneys", { n: selectedStageIds.size })}
              </button>
              <button
                onClick={deleteSelectedJourneys}
                disabled={bulkBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-40"
              >
                {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {t("venture.manager.deleteSelectedJourneys", { n: selectedStageIds.size })}
              </button>
            </>
          )}
        </div>
      )}

      {saveOpen && (
        <form onSubmit={saveJourneyTemplate} className="mb-4 p-3 rounded-xl border border-[var(--brand-orange)]/30 bg-tertiary space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
            {t("venture.manager.saveTemplateTitle")}
          </p>
          <input
            value={saveForm.name}
            onChange={(e) => setSaveForm({ ...saveForm, name: e.target.value })}
            placeholder={t("venture.manager.saveTemplateNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <textarea
            rows={2}
            value={saveForm.description}
            onChange={(e) => setSaveForm({ ...saveForm, description: e.target.value })}
            placeholder={t("venture.manager.saveTemplateDescPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => { setSaveOpen(false); setSaveForm({ name: "", description: "" }); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={savingSave} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
              {savingSave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.saveTemplate")}
            </button>
          </div>
        </form>
      )}

      {applyOpen && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("venture.manager.generateFromTemplate")}</label>
            <select value={tplSel} onChange={(e) => setTplSel(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
              <option value="">{t("venture.manager.selectTemplate")}</option>
              {journeyTemplates.map((tpl) => (
                <option key={`j-${tpl.id}`} value={`journey:${tpl.id}`}>{t("venture.manager.journeyTplOption", { name: tpl.name, count: tpl.stage_count || 0 })}</option>
              ))}
              {journeyTemplates.length > 0 && templates.length > 0 && <option disabled>──────────</option>}
              {templates.map((tpl) => (
                <option key={`p-${tpl.id}`} value={`plan:${tpl.id}`}>{t("venture.manager.planTplOption", { name: tpl.name, count: tpl.section_count || 0 })}</option>
              ))}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={savingTpl || !tplSel} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
            {savingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} {t("venture.manager.generate")}
          </button>
        </div>
      )}

      {addOpen && (
        <form onSubmit={addStage} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("venture.manager.stageNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder={t("venture.manager.stageDescPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <input
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder={t("venture.manager.stageObjectivePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <input
            type="date"
            value={form.target_date}
            onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.addStage")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : visibleStages.length === 0 ? (
        viewArchived ? (
          <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center">
            <Archive className="w-6 h-6 mx-auto text-slate-500 mb-2" />
            <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.emptyArchivedJourneys")}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-8 text-center">
            <Route className="w-6 h-6 mx-auto text-slate-500 mb-2" />
            <p className="text-xs font-bold text-[var(--text-primary)]">{t("venture.manager.noStages")}</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-md mx-auto">{t("venture.manager.noStagesDesc")}</p>
          </div>
        )
      ) : (
        <div className="space-y-5">
          {visibleStages.map((stage, i) => {
            const isEditing = editId === stage.id;
            const milestones = stage.milestones || [];
            const done = stage.milestone_counts?.completed || 0;
            const total = stage.milestone_counts?.total || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isDone = stage.status === "completed";
            const isActive = stage.status === "active";
            const isLocked = stage.status === "locked";
            return (
              <div key={stage.id} className="relative pl-10">
                {/* Timeline connector between stage nodes */}
                {i < visibleStages.length - 1 && (
                  <span aria-hidden className={`absolute left-[15px] top-9 -bottom-5 w-px ${isDone ? "bg-emerald-500/40" : "bg-[var(--border-primary)]"}`} />
                )}
                {/* Stage node */}
                <span
                  className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${stageNodeClass(stage.status)} ${isActive ? "ring-4 ring-blue-500/10" : ""}`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : (stage.stage_order || i + 1)}
                </span>

                <div className={`card overflow-hidden ${isLocked ? "opacity-80" : ""}`}>
                  {isEditing ? (
                    <form onSubmit={saveEdit} className="p-4 space-y-3">
                      <input
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder={t("venture.manager.stageNamePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                        required
                      />
                      <textarea
                        value={editForm.description || ""}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={2}
                        placeholder={t("venture.manager.stageDescPlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        value={editForm.objective || ""}
                        onChange={(e) => setEditForm({ ...editForm, objective: e.target.value })}
                        placeholder={t("venture.manager.stageObjectivePlaceholder")}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <input
                        type="date"
                        value={editForm.target_date || ""}
                        onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => { setEditId(null); setEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:bg-tertiary">
                          {t("common.cancel")}
                        </button>
                        <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1">
                          <Save className="w-3 h-3" /> {t("common.save")}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 min-w-0">
                            {access.manage && !stage.is_archived && (
                              <button
                                onClick={() => toggleSelectStage(stage.id)}
                                className={`mt-0.5 shrink-0 transition-colors ${selectedStageIds.has(String(stage.id)) ? "text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}
                                title={t("venture.manager.selectJourney")}
                              >
                                {selectedStageIds.has(String(stage.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </button>
                            )}
                            <h4 className={`text-sm font-black text-[var(--text-primary)] ${isDone ? "line-through text-slate-400" : ""}`}>{stage.name}</h4>
                          </div>
                          {statusPill(stage)}
                        </div>
                        {stage.description && <p className="text-xs text-[var(--text-secondary)] mt-1.5">{stage.description}</p>}
                        {stage.objective && (
                          <p className="text-[10px] text-[var(--text-secondary)] italic mt-1">
                            <span className="font-bold not-italic uppercase tracking-widest text-slate-500">{t("venture.manager.objective")}: </span>{stage.objective}
                          </p>
                        )}
                        {(stage.target_date || stage.completed_at || !isDone) && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-400">
                            {stage.target_date && <span>{t("venture.manager.targetDate", { date: fmtDate(stage.target_date) })}</span>}
                            {stage.completed_at && <span>{t("venture.manager.completedOn", { date: new Date(stage.completed_at).toLocaleDateString(lang) })}</span>}
                            {!isDone && (
                              <span className={isActive ? "text-sky-300/90" : "text-slate-500"}>
                                {t(isLocked ? "venture.manager.memberVisibilityLocked" : "venture.manager.memberVisibilityActive")}
                              </span>
                            )}
                          </div>
                        )}
                        {total > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                              <span>{t("venture.manager.milestoneProgress", { done, total })}</span>
                              <span className={isDone ? "text-emerald-400" : "text-[var(--brand-orange)]"}>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-tertiary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-gradient-to-r from-[var(--brand-orange)] to-orange-400"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {milestones.length > 0 && (
                        <div className="px-4 pb-4">
                          <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-[var(--border-primary)]/60 overflow-hidden">
                            {milestones.map((ms) => {
                              const msProgress = Math.min(100, Math.max(0, Number(ms.progress) || 0));
                              return (
                                <div key={ms.id} className="flex items-center gap-3 px-3 py-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${milestoneDotClass(ms.status)}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-bold text-[var(--text-primary)] truncate ${ms.status === "completed" ? "line-through text-slate-400" : ""}`}>
                                      {ms.title}
                                    </p>
                                    {msProgress > 0 && ms.status !== "completed" && (
                                      <div className="w-28 h-1 rounded-full bg-tertiary mt-1 overflow-hidden">
                                        <div className="h-full bg-sky-400/70 rounded-full" style={{ width: `${msProgress}%` }} />
                                      </div>
                                    )}
                                  </div>
                                  {msProgress > 0 && <span className="text-[10px] font-bold text-[var(--text-secondary)] w-8 text-right">{msProgress}%</span>}
                                  {ms.target_date && <span className="hidden sm:inline text-[10px] text-slate-500">{fmtDate(ms.target_date)}</span>}
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${milestoneStatusClass(ms.status)}`}>
                                    {milestoneStatusKey(ms.status)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {(access.edit || access.manage) && !isEditing && (
                    <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border-primary)]/60 bg-tertiary/40 px-2 py-1.5">
                      {stage.is_archived && access.manage && (
                        <button onClick={() => restoreOneJourney(stage)} disabled={bulkBusy} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-white/5 disabled:opacity-40" title={t("venture.manager.restoreJourney")}>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">{t("venture.manager.restoreJourney")}</span>
                        </button>
                      )}
                      {!stage.is_archived && (
                        <>
                      {access.edit && (
                        <button onClick={() => startEdit(stage)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-white/5" title={t("venture.manager.editStage")}>
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-[8px] font-black uppercase tracking-widest hidden md:inline">{t("venture.manager.editStage")}</span>
                        </button>
                      )}
                      {access.manage && (
                        <>
                          <span className="w-px h-4 bg-[var(--border-primary)] mx-1" />
                          <button onClick={() => patch({ action: "move", stage_id: stage.id, direction: "up" })} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-30" title={t("venture.manager.moveUp")}>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => patch({ action: "move", stage_id: stage.id, direction: "down" })} disabled={i === visibleStages.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-30" title={t("venture.manager.moveDown")}>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {isLocked && (
                            <button onClick={() => patch({ action: "activate", stage_id: stage.id })} className="p-1.5 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-white/5" title={t("venture.manager.activateStage")}>
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isActive && (
                            <>
                              <button onClick={() => patch({ action: "complete", stage_id: stage.id })} className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-white/5" title={t("venture.manager.markCompleted")}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => patch({ action: "lock", stage_id: stage.id })} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5" title={t("venture.manager.lockStage")}>
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {isDone && (
                            <button onClick={() => patch({ action: "reset", stage_id: stage.id })} className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-white/5" title={t("venture.manager.reopenStage")}>
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="w-px h-4 bg-[var(--border-primary)] mx-1" />
                          <button
                            onClick={() => setNotesStageId(notesStageId === stage.id ? null : stage.id)}
                            className={`p-1.5 rounded-lg hover:bg-white/5 ${notesStageId === stage.id ? "text-sky-300" : "text-slate-400 hover:text-sky-300"}`}
                            title={t("venture.manager.notes.title")}
                          >
                            <StickyNote className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => duplicateStage(stage)} disabled={dupBusy === stage.id} className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-white/5 disabled:opacity-40" title={t("venture.manager.duplicateStageTitle")}>
                            {dupBusy === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => archiveOneJourney(stage)} disabled={bulkBusy} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-white/5 disabled:opacity-40" title={t("venture.manager.archiveJourney")}>
                            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => deleteOneJourney(stage)} disabled={bulkBusy} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 disabled:opacity-40" title={t("venture.manager.deleteJourney")}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {notesStageId === stage.id && !isEditing && (
                  <div className="mt-2">
                    <ScopedNotes ventureId={ventureId} scopeType="journey_stage" scopeId={stage.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
