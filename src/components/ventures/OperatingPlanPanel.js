"use client";

import React, { useState, useEffect } from "react";
import { Target, Plus, X, Loader2, ChevronDown, ChevronRight, Trash2, Save, Link2, CheckCircle2, Copy } from "lucide-react";

/**
 * OperatingPlanPanel — Lead Manager operating plans for a Venture.
 * Plans contain sections (objective/instructions/status); sections link to
 * existing Venture objects (milestones/tasks/documents/sessions/notes).
 * Server-enforced against the operating_plan permission area. Founders never
 * reach this (API 404).
 */
export default function OperatingPlanPanel({ ventureId }) {
  const [plans, setPlans] = useState([]);
  const [access, setAccess] = useState({ create: false, edit: false, manage: false });
  const [openPlanId, setOpenPlanId] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", objective: "" });
  const [savingPlan, setSavingPlan] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: "", objective: "", instructions: "" });
  const [toast, setToast] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [tplSel, setTplSel] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPlans = async () => {
    try {
      const res = await fetch(`/api/ventures/${ventureId}/operating-plans`);
      const d = await res.json();
      if (d.success) {
        setPlans(d.plans || []);
        setAccess(d.access || {});
      }
    } catch (e) {
      console.error("Failed to load operating plans:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadPlan = async (planId) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${planId}`);
    const d = await res.json();
    if (d.success) setOpenPlan(d.plan);
  };

  useEffect(() => {
    if (ventureId) loadPlans();
  }, [ventureId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openPlanDetail = async (planId) => {
    setOpenPlanId(planId === openPlanId ? null : planId);
    if (planId !== openPlanId) await loadPlan(planId);
    else setOpenPlan(null);
  };

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

  const applyTemplate = async () => {
    if (!tplSel) return;
    setSavingTpl(true);
    try {
      const res = await fetch(`/api/venture-plan-templates/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: tplSel, venture: ventureId }),
      });
      const d = await res.json();
      if (d.success) {
        notify("Template applied — structure copied (no Venture data).");
        setApplyOpen(false);
        setTplSel("");
        await loadPlans();
      } else {
        notify(d.error || "Apply failed.", "error");
      }
    } catch (err) {
      notify("Apply failed.", "error");
    } finally {
      setSavingTpl(false);
    }
  };

  const saveAsTemplate = async (planId) => {
    const res = await fetch(`/api/venture-plan-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });
    const d = await res.json();
    if (d.success) {
      notify("Saved as reusable template.");
    } else {
      notify(d.error || "Save failed.", "error");
    }
  };

  const createPlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim()) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/operating-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      const d = await res.json();
      if (d.success) {
        notify("Operating plan created.");
        setNewPlanOpen(false);
        setPlanForm({ name: "", objective: "" });
        await loadPlans();
      } else {
        notify(d.error || "Create failed.", "error");
      }
    } catch (err) {
      notify("Create failed.", "error");
    } finally {
      setSavingPlan(false);
    }
  };

  const changePlanStatus = async (planId, status) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await res.json();
    if (d.success) {
      notify(`Plan ${status}.`);
      await loadPlans();
      if (openPlanId === planId) await loadPlan(planId);
    } else {
      notify(d.error || "Update failed.", "error");
    }
  };

  const addSection = async (e) => {
    e.preventDefault();
    if (!sectionForm.title.trim()) return;
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sectionForm),
    });
    const d = await res.json();
    if (d.success) {
      notify("Section added.");
      setSectionForm({ title: "", objective: "", instructions: "" });
      await loadPlans();
      await loadPlan(openPlanId);
    } else {
      notify(d.error || "Add failed.", "error");
    }
  };

  const setSectionStatus = async (sectionId, status) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, status }),
    });
    const d = await res.json();
    if (d.success) {
      await loadPlan(openPlanId);
      await loadPlans();
    } else {
      notify(d.error || "Update failed.", "error");
    }
  };

  const deleteSection = async (sectionId) => {
    if (!window.confirm("Delete this section?")) return;
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId }),
    });
    const d = await res.json();
    if (d.success) {
      notify("Section deleted.");
      await loadPlan(openPlanId);
      await loadPlans();
    } else {
      notify(d.error || "Delete failed.", "error");
    }
  };

  const addLink = async (sectionId, refType, refId, label) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, ref_type: refType, ref_id: refId, label }),
    });
    const d = await res.json();
    if (d.success) {
      notify("Linked.");
      await loadPlan(openPlanId);
    } else {
      notify(d.error || "Link failed.", "error");
    }
  };

  const removeLink = async (linkId) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId }),
    });
    const d = await res.json();
    if (d.success) {
      await loadPlan(openPlanId);
    } else {
      notify(d.error || "Remove failed.", "error");
    }
  };

  // Simple link picker (reference by type + id with label).
  const LinkPicker = ({ sectionId }) => {
    const [rt, setRt] = useState("milestone");
    const [rid, setRid] = useState("");
    const [label, setLabel] = useState("");
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <select value={rt} onChange={(e) => setRt(e.target.value)} className="px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]">
          <option value="milestone">Milestone</option>
          <option value="task">Task</option>
          <option value="document">Document</option>
          <option value="session">Session</option>
          <option value="note">Internal note</option>
        </select>
        <input
          value={rid}
          onChange={(e) => setRid(e.target.value)}
          placeholder="ID"
          className="w-24 px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Pitch Deck)"
          className="flex-1 min-w-[140px] px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
        <button
          onClick={() => { if (rid) addLink(sectionId, rt, rid, label || `${rt} ${rid}`); }}
          className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-[var(--brand-orange)] text-black flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" /> Link
        </button>
      </div>
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
          <Target className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> Operating Plans ({plans.length})
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
              onClick={() => setNewPlanOpen(!newPlanOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {newPlanOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {newPlanOpen ? "Cancel" : "New Plan"}
            </button>
          </div>
        )}
      </div>
      {applyOpen && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Apply reusable template</label>
            <select value={tplSel} onChange={(e) => setTplSel(e.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
              <option value="">Select template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.section_count || 0} sections)</option>
              ))}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={savingTpl || !tplSel} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
            {savingTpl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Apply
          </button>
        </div>
      )}
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">Lead Manager-defined operating structure: sections with objectives, tasks, documents, sessions and notes.</p>

      {newPlanOpen && (
        <form onSubmit={createPlan} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={planForm.name}
            onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
            placeholder="Plan name — e.g. Go-To-Market Readiness"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={planForm.objective}
            onChange={(e) => setPlanForm({ ...planForm, objective: e.target.value })}
            rows={2}
            placeholder="Objective / current assessment"
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={savingPlan} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Create Plan
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : plans.length === 0 ? (
        <p className="text-xs text-slate-500">No operating plans yet.</p>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
              <div className="w-full flex items-center justify-between gap-3 p-3 text-left bg-[var(--surface-2)]/40">
                <button onClick={() => openPlanDetail(p.id)} className="flex items-center gap-2 flex-1 min-w-0">
                  {openPlanId === p.id ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{p.name}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                    {p.section_count || 0} sections
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${p.status === "archived" ? "bg-slate-500/10 text-slate-400" : "bg-emerald-500/10 text-emerald-400"}`}>{p.status}</span>
                  {access.manage && p.status !== "archived" && (
                    <button onClick={() => changePlanStatus(p.id, "archived")} className="text-slate-400 hover:text-rose-400" title="Archive plan">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {openPlanId === p.id && openPlan && (
                <div className="p-3 border-t border-[var(--border-primary)] space-y-3">
                  {openPlan.objective && <p className="text-xs text-[var(--text-secondary)] italic">{openPlan.objective}</p>}
                  {openPlan.status === "draft" && access.manage && (
                    <div className="flex gap-2">
                      <button onClick={() => changePlanStatus(p.id, "active")} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">Activate</button>
                    </div>
                  )}
                  {openPlan.status === "active" && access.manage && (
                    <div className="flex gap-2">
                      <button onClick={() => changePlanStatus(p.id, "completed")} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">Mark Completed</button>
                      <button onClick={() => saveAsTemplate(p.id)} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">Save as Template</button>
                    </div>
                  )}

                  {openPlan.sections?.map((s) => (
                    <div key={s.id} className="rounded-lg border border-[var(--border-primary)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{s.title}</p>
                        <div className="flex items-center gap-1.5">
                          {access.manage && s.status !== "completed" && (
                            <button onClick={() => setSectionStatus(s.id, "completed")} className="text-slate-400 hover:text-emerald-400" title="Mark completed">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {access.manage && (
                            <button onClick={() => deleteSection(s.id)} className="text-slate-400 hover:text-rose-400" title="Delete section">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">{s.status}</span>
                        </div>
                      </div>
                      {s.objective && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{s.objective}</p>}
                      {s.instructions && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 italic">→ {s.instructions}</p>}
                      {s.links?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {s.links.map((l) => (
                            <span key={l.id} className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                              <Link2 className="w-2.5 h-2.5" /> {l.label || `${l.ref_type} ${l.ref_id}`}
                              {access.edit && (
                                <button onClick={() => removeLink(l.id)} className="hover:text-rose-400"><X className="w-2.5 h-2.5" /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {access.edit && <LinkPicker sectionId={s.id} />}
                    </div>
                  ))}

                  {access.edit && (
                    <form onSubmit={addSection} className="p-3 rounded-lg border border-dashed border-[var(--border-primary)] space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Add section</p>
                      <input
                        value={sectionForm.title}
                        onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                        placeholder="Section — e.g. Pitch Deck"
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                        required
                      />
                      <input
                        value={sectionForm.objective}
                        onChange={(e) => setSectionForm({ ...sectionForm, objective: e.target.value })}
                        placeholder="Objective (optional)"
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <textarea
                        value={sectionForm.instructions}
                        onChange={(e) => setSectionForm({ ...sectionForm, instructions: e.target.value })}
                        rows={2}
                        placeholder="Instructions / guidance (optional)"
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-[var(--brand-orange)] text-black flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add Section
                        </button>
                      </div>
                    </form>
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
