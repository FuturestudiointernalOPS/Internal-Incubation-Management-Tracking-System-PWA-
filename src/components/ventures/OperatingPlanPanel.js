"use client";

import React, { useState } from "react";
import { Target, Plus, X, Loader2, ChevronDown, ChevronRight, Trash2, Save, Link2, CheckCircle2, Copy } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * OperatingPlanPanel — Lead Manager operating plans for a Venture.
 * Plans contain sections (objective/instructions/status); sections link to
 * existing Venture objects (milestones/tasks/documents/sessions/notes).
 * Server-enforced against the operating_plan permission area. Founders never
 * reach this (API 404).
 */

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_ACCESS = { create: false, edit: false, manage: false };
const EMPTY_PLANS_READ = { plans: [], access: EMPTY_ACCESS };

const pickPlans = (payload) =>
  payload?.success ? { plans: payload.plans || [], access: payload.access || EMPTY_ACCESS } : EMPTY_PLANS_READ;

export default function OperatingPlanPanel({ ventureId }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [openPlanId, setOpenPlanId] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ name: "", objective: "" });
  const [savingPlan, setSavingPlan] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: "", objective: "", instructions: "" });
  const [toast, setToast] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const notify = (message, type = "success") => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // The plans and the caller's permissions arrive in one payload, so one read
  // serves both. The two reads below stay plain fetches: a plan's detail is asked
  // for when it is opened, and the templates when the picker is opened.
  const { data: plansRead, loading, refresh: refreshPlans } = useApi(
    ventureId ? `/api/ventures/${ventureId}/operating-plans` : null,
    { defaultValue: EMPTY_PLANS_READ, transform: pickPlans, deps: [ventureId] },
  );
  const { plans, access } = plansRead;

  const loadPlan = async (planId) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${planId}`);
    const payload = await res.json();
    if (payload.success) setOpenPlan(payload.plan);
  };

  const openPlanDetail = async (planId) => {
    setOpenPlanId(planId === openPlanId ? null : planId);
    if (planId !== openPlanId) await loadPlan(planId);
    else setOpenPlan(null);
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch(`/api/venture-plan-templates`);
      const payload = await res.json();
      if (payload.success) setTemplates(payload.templates || []);
    } catch (error) {
      console.error("Failed to load plan templates:", error);
    }
  };

  const toggleApply = async () => {
    const next = !applyOpen;
    setApplyOpen(next);
    if (next) await loadTemplates();
  };

  const applyTemplate = async () => {
    if (!selectedTemplateId) return;
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/venture-plan-templates/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selectedTemplateId, venture: ventureId }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.opPlan.templateApplied"));
        setApplyOpen(false);
        setSelectedTemplateId("");
        await refreshPlans();
      } else {
        notify(payload.error || t("venture.manager.applyFailed"), "error");
      }
    } catch {
      notify(t("venture.manager.applyFailed"), "error");
    } finally {
      setSavingTemplate(false);
    }
  };

  const saveAsTemplate = async (planId) => {
    const res = await fetch(`/api/venture-plan-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_id: planId }),
    });
    const payload = await res.json();
    if (payload.success) {
      notify(t("venture.opPlan.savedAsTemplate"));
    } else {
      notify(payload.error || t("venture.opPlan.saveFailed"), "error");
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    if (!planForm.name.trim()) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/operating-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planForm),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t("venture.opPlan.planCreated"));
        setNewPlanOpen(false);
        setPlanForm({ name: "", objective: "" });
        await refreshPlans();
      } else {
        notify(payload.error || t("venture.opPlan.createFailed"), "error");
      }
    } catch {
      notify(t("venture.opPlan.createFailed"), "error");
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
    const payload = await res.json();
    if (payload.success) {
      notify(t("venture.opPlan.planStatus", { status }));
      await refreshPlans();
      if (openPlanId === planId) await loadPlan(planId);
    } else {
      notify(payload.error || t("venture.opPlan.updateFailed"), "error");
    }
  };

  const addSection = async (event) => {
    event.preventDefault();
    if (!sectionForm.title.trim()) return;
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sectionForm),
    });
    const payload = await res.json();
    if (payload.success) {
      notify(t("venture.opPlan.sectionAdded"));
      setSectionForm({ title: "", objective: "", instructions: "" });
      await refreshPlans();
      await loadPlan(openPlanId);
    } else {
      notify(payload.error || t("venture.manager.addFailed"), "error");
    }
  };

  const setSectionStatus = async (sectionId, status) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, status }),
    });
    const payload = await res.json();
    if (payload.success) {
      await loadPlan(openPlanId);
      await refreshPlans();
    } else {
      notify(payload.error || t("venture.opPlan.updateFailed"), "error");
    }
  };

  const deleteSection = async (sectionId) => {
    if (!(await confirm({ message: t("venture.deleteSectionConfirm"), tone: "danger" }))) return;
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId }),
    });
    const payload = await res.json();
    if (payload.success) {
      notify(t("venture.opPlan.sectionDeleted"));
      await loadPlan(openPlanId);
      await refreshPlans();
    } else {
      notify(payload.error || t("venture.opPlan.deleteFailed"), "error");
    }
  };

  const addLink = async (sectionId, refType, refId, label) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section_id: sectionId, ref_type: refType, ref_id: refId, label }),
    });
    const payload = await res.json();
    if (payload.success) {
      notify(t("venture.opPlan.linked"));
      await loadPlan(openPlanId);
    } else {
      notify(payload.error || t("venture.opPlan.linkFailed"), "error");
    }
  };

  const removeLink = async (linkId) => {
    const res = await fetch(`/api/ventures/${ventureId}/operating-plans/${openPlanId}/sections`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link_id: linkId }),
    });
    const payload = await res.json();
    if (payload.success) {
      await loadPlan(openPlanId);
    } else {
      notify(payload.error || t("venture.opPlan.removeFailed"), "error");
    }
  };

  // Simple link picker (reference by type + id with label).
  const LinkPicker = ({ sectionId }) => {
    const [refType, setRefType] = useState("milestone");
    const [refId, setRefId] = useState("");
    const [label, setLabel] = useState("");
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <select value={refType} onChange={(event) => setRefType(event.target.value)} className="px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]">
          <option value="milestone">{t("venture.opPlan.linkTypes.milestone")}</option>
          <option value="task">{t("venture.opPlan.linkTypes.task")}</option>
          <option value="document">{t("venture.opPlan.linkTypes.document")}</option>
          <option value="session">{t("venture.opPlan.linkTypes.session")}</option>
          <option value="note">{t("venture.opPlan.linkTypes.internalNote")}</option>
        </select>
        <input
          value={refId}
          onChange={(event) => setRefId(event.target.value)}
          placeholder={t("venture.opPlan.linkIdPlaceholder")}
          className="w-24 px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={t("venture.opPlan.linkLabelPlaceholder")}
          className="flex-1 min-w-[140px] px-2 py-1 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
        />
        <button
          onClick={() => { if (refId) addLink(sectionId, refType, refId, label || `${refType} ${refId}`); }}
          className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded bg-[var(--brand-orange)] text-black flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" /> {t("venture.opPlan.link")}
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
          <Target className="w-3.5 h-3.5 text-[var(--brand-orange)]" /> {t("venture.opPlan.title")} ({plans.length})
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
            <button
              onClick={() => setNewPlanOpen(!newPlanOpen)}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5"
            >
              {newPlanOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {newPlanOpen ? t("common.cancel") : t("venture.opPlan.newPlan")}
            </button>
          </div>
        )}
      </div>
      {applyOpen && (
        <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("venture.opPlan.applyTemplate")}</label>
            <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
              <option value="">{t("venture.opPlan.selectTemplate")}</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name} ({t("venture.opPlan.sectionsCount", { count: template.section_count || 0 })})</option>
              ))}
            </select>
          </div>
          <button onClick={applyTemplate} disabled={savingTemplate || !selectedTemplateId} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
            {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} {t("venture.opPlan.apply")}
          </button>
        </div>
      )}
      <p className="text-[10px] text-slate-400 mb-3 -mt-1">{t("venture.opPlan.intro")}</p>

      {newPlanOpen && (
        <form onSubmit={createPlan} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
          <input
            value={planForm.name}
            onChange={(event) => setPlanForm({ ...planForm, name: event.target.value })}
            placeholder={t("venture.opPlan.planNamePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={planForm.objective}
            onChange={(event) => setPlanForm({ ...planForm, objective: event.target.value })}
            rows={2}
            placeholder={t("venture.opPlan.objectivePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={savingPlan} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.opPlan.createPlan")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>
      ) : plans.length === 0 ? (
        <p className="text-xs text-slate-500">{t("venture.opPlan.noPlans")}</p>
      ) : (
        <div className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-[var(--border-primary)] overflow-hidden">
              <div className="w-full flex items-center justify-between gap-3 p-3 text-left bg-surface-2">
                <button onClick={() => openPlanDetail(plan.id)} className="flex items-center gap-2 flex-1 min-w-0">
                  {openPlanId === plan.id ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  <span className="text-sm font-bold text-[var(--text-primary)] truncate">{plan.name}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                    {t("venture.opPlan.sectionsCount", { count: plan.section_count || 0 })}
                  </span>
                  <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded ${plan.status === "archived" ? "bg-slate-500/10 text-slate-400" : "bg-emerald-500/10 text-emerald-400"}`}>{plan.status}</span>
                  {access.manage && plan.status !== "archived" && (
                    <button onClick={() => changePlanStatus(plan.id, "archived")} className="text-slate-400 hover:text-rose-400" title={t("venture.opPlan.archivePlan")}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {openPlanId === plan.id && openPlan && (
                <div className="p-3 border-t border-[var(--border-primary)] space-y-3">
                  {openPlan.objective && <p className="text-xs text-[var(--text-secondary)] italic">{openPlan.objective}</p>}
                  {openPlan.status === "draft" && access.manage && (
                    <div className="flex gap-2">
                      <button onClick={() => changePlanStatus(plan.id, "active")} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">{t("venture.opPlan.activate")}</button>
                    </div>
                  )}
                  {openPlan.status === "active" && access.manage && (
                    <div className="flex gap-2">
                      <button onClick={() => changePlanStatus(plan.id, "completed")} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-blue-500/15 text-blue-400 hover:bg-blue-500/25">{t("venture.markCompleted")}</button>
                      <button onClick={() => saveAsTemplate(plan.id)} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">{t("venture.manager.saveTemplate")}</button>
                    </div>
                  )}

                  {openPlan.sections?.map((section) => (
                    <div key={section.id} className="rounded-lg border border-[var(--border-primary)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[var(--text-primary)]">{section.title}</p>
                        <div className="flex items-center gap-1.5">
                          {access.manage && section.status !== "completed" && (
                            <button onClick={() => setSectionStatus(section.id, "completed")} className="text-slate-400 hover:text-emerald-400" title={t("venture.manager.markCompleted")}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {access.manage && (
                            <button onClick={() => deleteSection(section.id)} className="text-slate-400 hover:text-rose-400" title={t("venture.opPlan.deleteSection")}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <span className="text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">{section.status}</span>
                        </div>
                      </div>
                      {section.objective && <p className="text-[10px] text-[var(--text-secondary)] mt-1">{section.objective}</p>}
                      {section.instructions && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 italic">→ {section.instructions}</p>}
                      {section.links?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {section.links.map((link) => (
                            <span key={link.id} className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                              <Link2 className="w-2.5 h-2.5" /> {link.label || `${link.ref_type} ${link.ref_id}`}
                              {access.edit && (
                                <button onClick={() => removeLink(link.id)} className="hover:text-rose-400"><X className="w-2.5 h-2.5" /></button>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                      {access.edit && <LinkPicker sectionId={section.id} />}
                    </div>
                  ))}

                  {access.edit && (
                    <form onSubmit={addSection} className="p-3 rounded-lg border border-dashed border-[var(--border-primary)] space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{t("venture.opPlan.addSectionLabel")}</p>
                      <input
                        value={sectionForm.title}
                        onChange={(event) => setSectionForm({ ...sectionForm, title: event.target.value })}
                        placeholder={t("venture.opPlan.sectionTitlePlaceholder")}
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                        required
                      />
                      <input
                        value={sectionForm.objective}
                        onChange={(event) => setSectionForm({ ...sectionForm, objective: event.target.value })}
                        placeholder={t("venture.opPlan.sectionObjectivePlaceholder")}
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <textarea
                        value={sectionForm.instructions}
                        onChange={(event) => setSectionForm({ ...sectionForm, instructions: event.target.value })}
                        rows={2}
                        placeholder={t("venture.opPlan.sectionInstructionsPlaceholder")}
                        className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                      />
                      <div className="flex justify-end">
                        <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded bg-[var(--brand-orange)] text-black flex items-center gap-1">
                          <Plus className="w-3 h-3" /> {t("venture.opPlan.addSection")}
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
