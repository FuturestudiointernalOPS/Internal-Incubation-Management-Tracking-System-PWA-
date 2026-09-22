"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Plus, Save, Check, X, RefreshCw } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const RESPONSIBILITIES_URL = "/api/venture-permissions/responsibilities?include_inactive=1";
const EMPTY_LIST = [];

const pickResponsibilities = (d) => (d?.success ? d.responsibilities || [] : []);
const pickMatrix = (d) => (d?.success ? d.matrix : null);

/**
 * GLOBAL Venture Permissions — Super Admin → Ventures → Permissions.
 *
 * The permission matrix exists ONCE globally and is the single source of
 * truth for every Venture. A responsibility (Lead Manager, Coach, …) defines
 * what someone can do; the Venture ASSIGNMENT decides where that profile
 * applies; the assignment SCOPE decides the boundaries.
 *
 * There is deliberately NO per-Venture permission configuration.
 */

const AREA_LABELS = {
  overview: "vadmin.globalPermissions.areas.overview",
  profile: "vadmin.globalPermissions.areas.profile",
  founders: "vadmin.globalPermissions.areas.founders",
  milestones: "vadmin.globalPermissions.areas.milestones",
  tasks: "vadmin.globalPermissions.areas.tasks",
  documents: "vadmin.globalPermissions.areas.documents",
  internal_notes: "vadmin.globalPermissions.areas.internalNotes",
  calendar: "vadmin.globalPermissions.areas.calendar",
  coaching: "vadmin.globalPermissions.areas.coaching",
  operating_plan: "vadmin.globalPermissions.areas.operatingPlan",
  staff_assignment: "vadmin.globalPermissions.areas.staffAssignment",
  permissions: "vadmin.globalPermissions.areas.permissions",
  settings: "vadmin.globalPermissions.areas.settings",
};

export default function GlobalVenturePermissionsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { prompt } = useDialogs();
  // The profile the reader is looking at is an explicit override on a computed
  // default: with no choice recorded the first profile of the list is shown, and
  // a background refresh cannot throw the choice away.
  const [chosenResp, setChosenResp] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("matrix");
  const [showNewResp, setShowNewResp] = useState(false);
  const [newRespName, setNewRespName] = useState("");
  const [newRespDesc, setNewRespDesc] = useState("");
  const [savingResp, setSavingResp] = useState(false);

  // The responsibilities and the matrix for the selected one, through the shared
  // hook: it owns the cache, the cache-first paint and the discarding of a stale
  // answer, so the page keeps no copy of its own and reads during render. The
  // matrix is addressed on the selected profile, so choosing another one asks
  // for that profile's matrix rather than re-running a loader by hand.
  const {
    data: responsibilities,
    loading,
    refresh: refreshResponsibilities,
  } = useApi(RESPONSIBILITIES_URL, {
    defaultValue: EMPTY_LIST,
    transform: pickResponsibilities,
  });
  const selectedResp = chosenResp || responsibilities[0]?.code || "";

  const { data: matrix, refresh: refreshMatrix } = useApi(
    selectedResp
      ? `/api/venture-permissions/matrix?responsibility=${encodeURIComponent(selectedResp)}`
      : null,
    { defaultValue: null, transform: pickMatrix, deps: [selectedResp] },
  );

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleCapability = async (area, action, current) => {
    const next = !current;
    try {
      const res = await fetch("/api/venture-permissions/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responsibility: selectedResp, area, action, allowed: next }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("vadmin.globalPermissions.toastGlobalUpdated", { responsibility: selectedResp }));
        await refreshMatrix();
      } else {
        notify(d.error || t("vadmin.globalPermissions.updateFailed"), "error");
      }
    } catch {
      notify(t("vadmin.globalPermissions.updateFailed"), "error");
    }
  };

  const createResponsibility = async (e) => {
    e.preventDefault();
    if (!newRespName.trim()) return;
    setSavingResp(true);
    try {
      const res = await fetch("/api/venture-permissions/responsibilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRespName, description: newRespDesc }),
      });
      const d = await res.json();
      if (d.success) {
        notify(t("vadmin.globalPermissions.responsibilityCreated"));
        setShowNewResp(false);
        setNewRespName("");
        setNewRespDesc("");
        setChosenResp(d.responsibility.code);
        await refreshResponsibilities();
      } else {
        notify(d.error || t("vadmin.globalPermissions.createFailed"), "error");
      }
    } catch {
      notify(t("vadmin.globalPermissions.createFailed"), "error");
    } finally {
      setSavingResp(false);
    }
  };

  const toggleActive = async (code, isActive) => {
    await fetch("/api/venture-permissions/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, is_active: !isActive }),
    });
    notify(!isActive ? t("vadmin.globalPermissions.responsibilityActivated") : t("vadmin.globalPermissions.responsibilityDeactivated"));
    await refreshResponsibilities();
  };

  const rename = async (resp) => {
    const next = await prompt({ message: t("vadmin.globalPermissions.renamePrompt"), defaultValue: resp.name });
    if (!next || next.trim() === resp.name) return;
    await fetch("/api/venture-permissions/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: resp.code, name: next.trim() }),
    });
    notify(t("vadmin.globalPermissions.renamedNotice"));
    await refreshResponsibilities();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const areaNames = matrix ? Object.keys(matrix) : [];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-2 rounded-xl text-sm text-white shadow-lg ${toast.type === "error" ? "bg-rose-500" : "bg-emerald-500"}`}>
          {toast.msg}
        </div>
      )}

      <button
        onClick={() => router.push("/admin/ventures")}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> {t("vadmin.detail.backToVentures")}
      </button>

      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)]">{t("vadmin.globalPermissions.title")}</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {t("vadmin.globalPermissions.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">{t("vadmin.globalPermissions.badgeGlobal")}</span>
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">{t("vadmin.globalPermissions.noPerVentureMatrix")}</span>
          </div>
        </div>

        <div className="flex gap-1 mt-6 border-b border-[var(--border-primary)] overflow-x-auto">
          {[
            { id: "matrix", label: t("vadmin.globalPermissions.tabMatrix") },
            { id: "responsibilities", label: t("vadmin.globalPermissions.tabResponsibilities") },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                  : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.globalPermissions.matrixTitle")}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("vadmin.globalPermissions.matrixSubtitle")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedResp}
                  onChange={(e) => setChosenResp(e.target.value)}
                  className="px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                >
                  {responsibilities.map((r) => (
                    <option key={r.code} value={r.code}>{r.name}{r.is_active ? "" : t("vadmin.globalPermissions.inactiveSuffix")}</option>
                  ))}
                </select>
                <button onClick={refreshMatrix} className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
                  <RefreshCw className="w-3 h-3" /> {t("common.refresh")}
                </button>
              </div>
            </div>
          </div>

          {!matrix ? (
            <div className="card text-center py-10 text-slate-500">{t("vadmin.globalPermissions.loadingMatrix")}</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {areaNames.map((area) => (
                <div key={area} className="card">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{AREA_LABELS[area] ? t(AREA_LABELS[area]) : area}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(matrix[area]).map((action) => {
                      const enabled = matrix[area][action];
                      return (
                        <button
                          key={action}
                          onClick={() => toggleCapability(area, action, enabled)}
                          className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded transition-all flex items-center gap-1 ${
                            enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {enabled ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                          {action}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-500 px-1">
            {t("vadmin.globalPermissions.legend")}
          </p>
        </div>
      )}

      {activeTab === "responsibilities" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.globalPermissions.responsibilitiesTitle")}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("vadmin.globalPermissions.responsibilitiesSubtitle")}
                </p>
              </div>
              <button onClick={() => setShowNewResp(!showNewResp)} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> {t("vadmin.globalPermissions.addResponsibility")}
              </button>
            </div>
            {showNewResp && (
              <form onSubmit={createResponsibility} className="mt-5 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
                <input value={newRespName} onChange={(e) => setNewRespName(e.target.value)} placeholder={t("vadmin.globalPermissions.newResponsibilityNamePlaceholder")} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" required />
                <textarea value={newRespDesc} onChange={(e) => setNewRespDesc(e.target.value)} rows={2} placeholder={t("vadmin.detail.description")} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" />
                <div className="flex justify-end">
                  <button type="submit" disabled={savingResp} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                    {savingResp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("common.create")}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {responsibilities.map((r) => (
              <div key={r.code} className={`card ${r.is_active ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => rename(r)} className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)]">{r.name}</button>
                  <button onClick={() => toggleActive(r.code, r.is_active)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${r.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                    {r.is_active ? t("vadmin.globalPermissions.active") : t("vadmin.globalPermissions.inactive")}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mb-1">{r.code}</p>
                {r.description && <p className="text-xs text-slate-500 mb-2">{r.description}</p>}
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">{t("vadmin.globalPermissions.activeAssignments", { count: r.active_assignments || 0 })}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
