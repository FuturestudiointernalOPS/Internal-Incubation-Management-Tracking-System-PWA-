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
  RotateCcw,
  Pencil,
  Lock,
  Play,
} from "lucide-react";

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
  const { t } = useI18n();
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

  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/journey`);
      const d = await res.json();
      if (d.success) {
        setStages(d.stages || []);
        setAccess(d.access || {});
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
        notify("Stage added. It stays locked until you activate it.");
        setForm({ name: "", description: "", objective: "", target_date: "" });
        setAddOpen(false);
        setStages(d.stages || []);
      } else {
        notify(d.error || "Add failed.", "error");
      }
    } catch (err) {
      notify("Add failed.", "error");
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
    else notify(d.error || "Action failed.", "error");
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
      notify("Stage updated.");
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
      const res = await fetch(`/api/ventures/${ventureId}/journey/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: tplSel }),
      });
      const d = await res.json();
      if (d.success) {
        notify("Journey generated from template — structure only (no Venture data).");
        setApplyOpen(false);
        setTplSel("");
        setStages(d.stages || []);
      } else {
        notify(d.error || "Apply failed.", "error");
      }
    } catch (err) {
      notify("Apply failed.", "error");
    } finally {
      setSavingTpl(false);
    }
  };

  const statusPill = (stage) => {
    const cls =
      stage.status === "completed"
        ? "bg-emerald-500/10 text-emerald-400"
        : stage.status === "active"
          ? "bg-blue-500/10 text-blue-400"
          : "bg-slate-500/10 text-slate-400";
    return (
      <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${cls}`}>{stage.status}</span>
    );
  };

  return (
    <div className="card">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-xl text-sm text-white shadow-lg ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Route className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Venture Journey ({stages.length} stages)
        </h3>
        {access.create && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleApply}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              {applyOpen ? "Cancel" : "From Template"}
            </button>
            <button
              onClick={() => setAddOpen(!addOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {addOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {addOpen ? "Cancel" : "Add Stage"}
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">
        Define the journey this Venture actually needs — it is not a fixed curriculum. Members see only the published stages (name, description, objective, target date, status).
      </p>

      {applyOpen && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Generate journey from a reusable template</label>
            <select value={tplSel} onChange={(e) => setTplSel(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
              <option value="">Select template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.section_count || 0} sections)</option>
              ))}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={savingTpl || !tplSel} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
            {savingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Generate
          </button>
        </div>
      )}

      {addOpen && (
        <form onSubmit={addStage} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Stage — e.g. Due Diligence, Go-To-Market Readiness"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="What this stage is (shown to the Venture)"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <input
            value={form.objective}
            onChange={(e) => setForm({ ...form, objective: e.target.value })}
            placeholder="Objective / expected outcome (optional)"
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
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Add Stage
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : stages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-primary)] p-6 text-center">
          <Route className="w-6 h-6 mx-auto text-slate-500 mb-2" />
          <p className="text-xs font-bold text-[var(--text-primary)]">No journey defined yet</p>
          <p className="text-[10px] text-slate-500 mt-1">
            Add stages for this Venture or generate the journey from a reusable template. The Venture will see an empty state until you publish stages.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={stage.id} className={`rounded-xl border border-[var(--border-primary)] p-3 ${stage.status === "locked" ? "opacity-75" : ""}`}>
              {editId === stage.id ? (
                <form onSubmit={saveEdit} className="space-y-2">
                  <input
                    value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Stage name"
                    className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                    required
                  />
                  <textarea
                    value={editForm.description || ""}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={2}
                    placeholder="Description (shown to the Venture)"
                    className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  />
                  <input
                    value={editForm.objective || ""}
                    onChange={(e) => setEditForm({ ...editForm, objective: e.target.value })}
                    placeholder="Objective / expected outcome"
                    className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  />
                  <input
                    type="date"
                    value={editForm.target_date || ""}
                    onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => { setEditId(null); setEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border border-[var(--border-primary)] text-slate-500">
                      Cancel
                    </button>
                    <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-[var(--brand-orange)] text-black flex items-center gap-1">
                      <Save className="w-3 h-3" /> Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    stage.status === "completed" ? "bg-emerald-500/15 text-emerald-400" :
                    stage.status === "active" ? "bg-blue-500/15 text-blue-400" :
                    "bg-slate-500/10 text-slate-400"
                  }`}>
                    {stage.status === "completed" ? "✓" : stage.stage_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-bold text-[var(--text-primary)] ${stage.status === "completed" ? "line-through text-slate-400" : ""}`}>{stage.name}</p>
                      {statusPill(stage)}
                    </div>
                    {stage.description && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{stage.description}</p>}
                    {stage.objective && <p className="text-[10px] text-[var(--text-secondary)] italic mt-0.5">Objective: {stage.objective}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                      {stage.target_date && <span>Target: {new Date(`${stage.target_date}T00:00:00`).toLocaleDateString()}</span>}
                      {stage.completed_at && <span>Completed {new Date(stage.completed_at).toLocaleDateString()}</span>}
                      {stage.milestone_counts?.total > 0 && (
                        <span className="text-sky-300/90">
                          {t("venture.manager.milestoneProgress", { done: stage.milestone_counts.completed || 0, total: stage.milestone_counts.total })}
                        </span>
                      )}
                      {stage.status !== "completed" && (
                        <span className="text-sky-300/90">
                          {stage.status === "locked" ? t("venture.manager.memberVisibilityLocked") : t("venture.manager.memberVisibilityActive")}
                        </span>
                      )}
                    </div>
                  </div>

                  {(access.edit || access.manage) && (
                    <div className="flex items-center gap-1 shrink-0">
                      {access.edit && (
                        <button onClick={() => startEdit(stage)} className="p-1 text-slate-400 hover:text-[var(--text-primary)]" title="Edit stage">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {access.manage && (
                        <>
                          <button onClick={() => patch({ action: "move", stage_id: stage.id, direction: "up" })} disabled={i === 0} className="p-1 text-slate-400 hover:text-[var(--text-primary)] disabled:opacity-30" title="Move up">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => patch({ action: "move", stage_id: stage.id, direction: "down" })} disabled={i === stages.length - 1} className="p-1 text-slate-400 hover:text-[var(--text-primary)] disabled:opacity-30" title="Move down">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          {stage.status === "locked" && (
                            <button onClick={() => patch({ action: "activate", stage_id: stage.id })} className="p-1 text-blue-400 hover:text-blue-300" title="Activate (current stage)">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {stage.status === "active" && (
                            <>
                              <button onClick={() => patch({ action: "complete", stage_id: stage.id })} className="p-1 text-emerald-400 hover:text-emerald-300" title="Mark completed">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => patch({ action: "lock", stage_id: stage.id })} className="p-1 text-slate-400 hover:text-slate-200" title="Lock stage">
                                <Lock className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {stage.status === "completed" && (
                            <button onClick={() => patch({ action: "reset", stage_id: stage.id })} className="p-1 text-amber-400 hover:text-amber-300" title="Reopen from this stage">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => duplicateStage(stage)} disabled={dupBusy === stage.id} className="p-1 text-slate-400 hover:text-sky-300 disabled:opacity-40" title={t("venture.manager.duplicateStageTitle")}>
                            {dupBusy === stage.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CopyPlus className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={async () => { if (window.confirm(`Delete stage "${stage.name}"? This does not delete Venture data — only the journey stage.`)) { const ok = await patch({ action: "delete", stage_id: stage.id }); if (ok) notify("Stage deleted."); } }} className="p-1 text-slate-400 hover:text-rose-400" title="Delete stage">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
