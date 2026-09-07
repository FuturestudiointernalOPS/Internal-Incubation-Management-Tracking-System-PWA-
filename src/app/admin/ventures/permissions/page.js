"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Plus, Save, Check, X, RefreshCw } from "lucide-react";

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
  overview: "Venture Overview",
  profile: "Venture Profile",
  founders: "Founders / Members",
  milestones: "Milestones",
  tasks: "Tasks",
  documents: "Documents",
  internal_notes: "Internal Notes",
  calendar: "Calendar",
  coaching: "Coaching Sessions",
  operating_plan: "Operating Plan",
  staff_assignment: "Staff Assignment",
  permissions: "Venture Permissions",
  settings: "Venture Settings",
};

export default function GlobalVenturePermissionsPage() {
  const router = useRouter();
  const [responsibilities, setResponsibilities] = useState([]);
  const [selectedResp, setSelectedResp] = useState("");
  const [matrix, setMatrix] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("matrix");
  const [showNewResp, setShowNewResp] = useState(false);
  const [newRespName, setNewRespName] = useState("");
  const [newRespDesc, setNewRespDesc] = useState("");
  const [savingResp, setSavingResp] = useState(false);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadResponsibilities = useCallback(async () => {
    const res = await fetch("/api/venture-permissions/responsibilities?include_inactive=1");
    const d = await res.json();
    if (d.success) {
      setResponsibilities(d.responsibilities || []);
      setSelectedResp((prev) => prev || (d.responsibilities?.length ? d.responsibilities[0].code : ""));
    }
  }, []);

  const loadMatrix = useCallback(async (respCode) => {
    if (!respCode) return;
    const res = await fetch(`/api/venture-permissions/matrix?responsibility=${encodeURIComponent(respCode)}`);
    const d = await res.json();
    if (d.success) setMatrix(d.matrix);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadResponsibilities();
      } catch (e) {
        console.error("Failed to load responsibilities:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadResponsibilities]);

  useEffect(() => {
    if (selectedResp) loadMatrix(selectedResp);
  }, [selectedResp, loadMatrix]);

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
        notify(`Global ${selectedResp} permission updated — applies to every Venture immediately.`);
        await loadMatrix(selectedResp);
      } else {
        notify(d.error || "Update failed.", "error");
      }
    } catch (e) {
      notify("Update failed.", "error");
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
        notify("Responsibility created (global profile).");
        setShowNewResp(false);
        setNewRespName("");
        setNewRespDesc("");
        setSelectedResp(d.responsibility.code);
        await loadResponsibilities();
      } else {
        notify(d.error || "Create failed.", "error");
      }
    } catch (err) {
      notify("Create failed.", "error");
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
    notify(!isActive ? "Responsibility activated." : "Responsibility deactivated globally.");
    await loadResponsibilities();
  };

  const rename = async (resp) => {
    const next = window.prompt("Responsibility display name:", resp.name);
    if (!next || next.trim() === resp.name) return;
    await fetch("/api/venture-permissions/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: resp.code, name: next.trim() }),
    });
    notify("Renamed — assignments and permissions unchanged.");
    await loadResponsibilities();
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
        <ArrowLeft className="w-3 h-3" /> Back to Ventures
      </button>

      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)]">Global Venture Permissions</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Configured once · applies to every Venture. Assignments and scope are set per Venture.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">Global</span>
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">No per-Venture matrix</span>
          </div>
        </div>

        <div className="flex gap-1 mt-6 border-b border-[var(--border-primary)] overflow-x-auto">
          {[
            { id: "matrix", label: "Permission Matrix" },
            { id: "responsibilities", label: "Responsibilities" },
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
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global responsibility access matrix</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Changing a profile here updates that responsibility on every Venture immediately — no per-Venture configuration.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedResp}
                  onChange={(e) => setSelectedResp(e.target.value)}
                  className="px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                >
                  {responsibilities.map((r) => (
                    <option key={r.code} value={r.code}>{r.name}{r.is_active ? "" : " (inactive)"}</option>
                  ))}
                </select>
                <button onClick={() => loadMatrix(selectedResp)} className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>
          </div>

          {!matrix ? (
            <div className="card text-center py-10 text-slate-500">Loading matrix…</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {areaNames.map((area) => (
                <div key={area} className="card">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{AREA_LABELS[area] || area}</h4>
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
            Green = allowed globally · Grey = denied globally. Super Admin is never constrained by these profiles.
          </p>
        </div>
      )}

      {activeTab === "responsibilities" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configurable responsibilities</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Responsibilities are GLOBAL profiles. Names are editable; the underlying code never changes. Assignments make them Venture-specific.
                </p>
              </div>
              <button onClick={() => setShowNewResp(!showNewResp)} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Add Responsibility
              </button>
            </div>
            {showNewResp && (
              <form onSubmit={createResponsibility} className="mt-5 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
                <input value={newRespName} onChange={(e) => setNewRespName(e.target.value)} placeholder="e.g. Mentor, Reviewer, Growth Advisor…" className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" required />
                <textarea value={newRespDesc} onChange={(e) => setNewRespDesc(e.target.value)} rows={2} placeholder="Description" className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" />
                <div className="flex justify-end">
                  <button type="submit" disabled={savingResp} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                    {savingResp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Create
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
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mb-1">{r.code}</p>
                {r.description && <p className="text-xs text-slate-500 mb-2">{r.description}</p>}
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">{r.active_assignments || 0} active assignments</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
