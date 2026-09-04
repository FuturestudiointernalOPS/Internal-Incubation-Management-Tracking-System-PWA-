"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Shield, Plus, Trash2, Save, UserPlus, RefreshCw, Check, X,
} from "lucide-react";

/**
 * Venture Permissions — Super Admin configuration surface (Phase 1).
 * Admin → Ventures → [Venture] → Permissions
 *
 * Responsibilities are configurable contextual assignments. Permission
 * matrix rows are stored as data (platform defaults + per-venture overrides)
 * and enforced at runtime by the Venture permission evaluator.
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

export default function VenturePermissionsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [venture, setVenture] = useState(null);
  const [responsibilities, setResponsibilities] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [matrix, setMatrix] = useState(null);
  const [matrixDefaults, setMatrixDefaults] = useState(null);
  const [selectedResp, setSelectedResp] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState("assignments");

  // Add-assignment form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [contactQ, setContactQ] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [pickedContact, setPickedContact] = useState(null);
  const [assignForm, setAssignForm] = useState({ responsibility_code: "", scope_type: "venture_wide", scope_ref: "" });

  // New responsibility form
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
      setSelectedResp((prev) => {
        if (prev) return prev;
        return d.responsibilities?.length ? d.responsibilities[0].code : "";
      });
    }
  }, []);

  const loadScopes = async () => {
    const res = await fetch("/api/venture-permissions/scopes");
    const d = await res.json();
    if (d.success) setScopes(d.scopes || []);
  };

  const loadAssignments = async () => {
    const res = await fetch(`/api/ventures/${id}/staff-assignments`);
    const d = await res.json();
    if (d.success) setAssignments(d.assignments || []);
  };

  const loadMatrix = useCallback(async (respCode) => {
    if (!respCode) return;
    const [v, g] = await Promise.all([
      fetch(`/api/venture-permissions/matrix?responsibility=${encodeURIComponent(respCode)}&venture=${id}`),
      fetch(`/api/venture-permissions/matrix?responsibility=${encodeURIComponent(respCode)}`),
    ]);
    const dv = await v.json();
    const dg = await g.json();
    if (dv.success) setMatrix(dv.matrix);
    if (dg.success) setMatrixDefaults(dg.matrix);
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const vRes = await fetch(`/api/ventures/${id}`);
        const v = await vRes.json();
        if (v.success) setVenture(v.venture);
        await Promise.all([loadResponsibilities(), loadScopes(), loadAssignments()]);
      } catch (e) {
        console.error("Failed to load permission config:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedResp) loadMatrix(selectedResp);
  }, [selectedResp, loadMatrix]);

  // ── Contact search (internal CRM lookup; staff picker) ──
  const searchContacts = async (q) => {
    if (!q || q.length < 2) { setContactResults([]); return; }
    setSearchingContacts(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (d.success) setContactResults(d.contacts || []);
    } catch (e) { console.error(e); }
    finally { setSearchingContacts(false); }
  };

  // ── Matrix toggle ──
  const toggleCapability = async (area, action, current, isOverride, defaultValue) => {
    const next = !current;
    try {
      if (isOverride) {
        // Revert to platform default when it equals what the user now wants.
        if (next === defaultValue) {
          await fetch("/api/venture-permissions/matrix", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ venture: id, responsibility: selectedResp, area, action }),
          });
        } else {
          await fetch("/api/venture-permissions/matrix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ venture: id, responsibility: selectedResp, area, action, allowed: next }),
          });
        }
      } else {
        await fetch("/api/venture-permissions/matrix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ venture: id, responsibility: selectedResp, area, action, allowed: next }),
        });
      }
      notify("Permission updated — enforced immediately.");
      await loadMatrix(selectedResp);
    } catch (e) {
      notify("Failed to update permission.", "error");
    }
  };

  const resetOverride = async (area, action) => {
    try {
      await fetch("/api/venture-permissions/matrix", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture: id, responsibility: selectedResp, area, action }),
      });
      notify("Reset to platform default.");
      await loadMatrix(selectedResp);
    } catch (e) {
      notify("Failed to reset.", "error");
    }
  };

  // ── Assignment actions ──
  const submitAssignment = async (e) => {
    e.preventDefault();
    if (!pickedContact || !assignForm.responsibility_code) {
      notify("Pick a staff member and a responsibility.", "error");
      return;
    }
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/ventures/${id}/staff-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_contact_id: pickedContact.cid,
          responsibility_code: assignForm.responsibility_code,
          scope_type: assignForm.scope_type,
          scope_ref_type: assignForm.scope_type !== "venture_wide" ? assignForm.scope_type : null,
          scope_ref_id: assignForm.scope_type !== "venture_wide" ? (assignForm.scope_ref || null) : null,
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify("Staff member assigned to this Venture.");
        setShowAssignForm(false);
        setPickedContact(null);
        setContactQ("");
        setContactResults([]);
        setAssignForm({ responsibility_code: "", scope_type: "venture_wide", scope_ref: "" });
        await loadAssignments();
      } else {
        notify(d.error || "Assignment failed.", "error");
      }
    } catch (err) {
      notify("Assignment failed.", "error");
    } finally {
      setSavingAssign(false);
    }
  };

  const removeAssignment = async (assignmentId) => {
    const res = await fetch(`/api/ventures/${id}/staff-assignments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, action: "remove" }),
    });
    const d = await res.json();
    if (d.success) {
      notify("Assignment removed. Staff member no longer accesses this Venture.");
      setAssignments(d.assignments || []);
    } else {
      notify(d.error || "Remove failed.", "error");
    }
  };

  // ── Responsibility actions ──
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
        notify("Responsibility created.");
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

  const toggleResponsibilityActive = async (code, isActive) => {
    await fetch("/api/venture-permissions/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, is_active: !isActive }),
    });
    notify(!isActive ? "Responsibility activated." : "Responsibility deactivated (existing assignments keep their history).");
    await loadResponsibilities();
  };

  const renameResponsibility = async (resp) => {
    const next = window.prompt("Responsibility display name:", resp.name);
    if (!next || next.trim() === resp.name) return;
    await fetch("/api/venture-permissions/responsibilities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: resp.code, name: next.trim() }),
    });
    notify("Responsibility renamed — assignments and permissions unchanged.");
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
        onClick={() => router.push(`/admin/ventures/${id}`)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
      >
        <ArrowLeft className="w-3 h-3" /> Back to {venture?.company_name || "Venture"}
      </button>

      <div className="card">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[var(--text-primary)]">Venture Permissions</h1>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {venture?.company_name} · {venture?.venture_id} — responsibilities, access matrix and staff assignments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">Super Admin config</span>
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-slate-500/10 text-slate-400">Delegated access only</span>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mt-6 border-b border-[var(--border-primary)] overflow-x-auto">
          {[
            { id: "assignments", label: "Staff Assignments" },
            { id: "matrix", label: "Permission Matrix" },
            { id: "responsibilities", label: "Responsibilities" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
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

      {/* ── STAFF ASSIGNMENTS ─────────────────────────────────────── */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Who is assigned to this Venture</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Staff access comes from these assignments — never from the staff role alone. Super Admin always retains global access.
                </p>
              </div>
              <button
                onClick={() => setShowAssignForm(!showAssignForm)}
                className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <UserPlus className="w-3.5 h-3.5" /> Assign Staff
              </button>
            </div>

            {showAssignForm && (
              <form onSubmit={submitAssignment} className="mt-5 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Find staff member</label>
                  {pickedContact ? (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-primary)]">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">{pickedContact.name}</p>
                        <p className="text-[10px] text-slate-500">{pickedContact.email || pickedContact.cid}</p>
                      </div>
                      <button type="button" onClick={() => { setPickedContact(null); setContactQ(""); }} className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1">
                        <X className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={contactQ}
                        onChange={(e) => { setContactQ(e.target.value); searchContacts(e.target.value); }}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                        placeholder="Type at least 2 characters…"
                      />
                      {searchingContacts && <p className="text-xs text-slate-500 mt-1">Searching…</p>}
                      {contactResults.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)]">
                          {contactResults.map((c) => (
                            <button
                              type="button"
                              key={c.cid}
                              onClick={() => { setPickedContact(c); setContactResults([]); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{c.name}</span>
                              {c.email && <span className="ml-2 text-slate-500">{c.email}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Responsibility</label>
                    <select
                      value={assignForm.responsibility_code}
                      onChange={(e) => setAssignForm({ ...assignForm, responsibility_code: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                    >
                      <option value="">Select…</option>
                      {responsibilities.filter((r) => r.is_active).map((r) => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope</label>
                    <select
                      value={assignForm.scope_type}
                      onChange={(e) => setAssignForm({ ...assignForm, scope_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                    >
                      {scopes.map((s) => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  {assignForm.scope_type !== "venture_wide" && (
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope reference (ID)</label>
                      <input
                        value={assignForm.scope_ref}
                        onChange={(e) => setAssignForm({ ...assignForm, scope_ref: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                        placeholder="e.g. milestone id or section id"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button type="submit" disabled={savingAssign} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50">
                    {savingAssign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Assign
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Current assignments ({assignments.length})</h3>
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-500">No staff assigned yet. Staff members gain Venture access only through an assignment.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)]">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{a.staff_name || a.staff_contact_id}</p>
                      <p className="text-[10px] text-slate-500">
                        {a.responsibility_name || a.responsibility_code}
                        {a.scope_type !== "venture_wide" && ` · Scope: ${a.scope_type}${a.scope_ref_id ? ` (${a.scope_ref_id})` : ""}`}
                        {a.staff_email && ` · ${a.staff_email}`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeAssignment(a.id)}
                      className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PERMISSION MATRIX ──────────────────────────────────────── */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Responsibility access matrix</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cells show the effective permission for this Venture (platform default + overrides). Toggle a cell to change it for this Venture only.
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
                <button
                  onClick={() => loadMatrix(selectedResp)}
                  className="px-3 py-2 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)] flex items-center gap-1.5 text-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </div>
          </div>

          {!matrix ? (
            <div className="card text-center py-10 text-slate-500">Loading matrix…</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {areaNames.map((area) => {
                const cells = matrix[area];
                return (
                  <div key={area} className="card">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{AREA_LABELS[area] || area}</h4>
                      <button
                        onClick={() => Object.keys(cells).forEach((action) => { if (cells[action].overridden) resetOverride(area, action); })}
                        className="text-[9px] text-slate-400 hover:text-amber-400 uppercase tracking-widest font-black"
                        title="Reset all overrides in this area"
                      >
                        Reset overrides
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(cells).map((action) => {
                        const cell = cells[action];
                        const def = matrixDefaults?.[area]?.[action]?.allowed;
                        const enabled = cell.allowed;
                        return (
                          <button
                            key={action}
                            onClick={() => toggleCapability(area, action, cell.allowed, cell.overridden, def)}
                            title={cell.overridden ? `Override (default: ${def ? "allowed" : "denied"})` : "Platform default"}
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded transition-all flex items-center gap-1 ${
                              enabled
                                ? cell.overridden
                                  ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                                  : "bg-emerald-500/15 text-emerald-400"
                                : "bg-slate-500/10 text-slate-500"
                            }`}
                          >
                            {enabled ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                            {action}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-slate-500 px-1">
            Amber = overridden for this Venture · Green = allowed (platform default) · Grey = denied. Overrides inherit the platform default until changed.
          </p>
        </div>
      )}

      {/* ── RESPONSIBILITIES ───────────────────────────────────────── */}
      {activeTab === "responsibilities" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Configurable responsibilities</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Responsibilities are contextual assignments, not global roles. Names are editable; the underlying code never changes.
                </p>
              </div>
              <button
                onClick={() => setShowNewResp(!showNewResp)}
                className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add Responsibility
              </button>
            </div>

            {showNewResp && (
              <form onSubmit={createResponsibility} className="mt-5 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Display name</label>
                  <input
                    value={newRespName}
                    onChange={(e) => setNewRespName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                    placeholder="e.g. Mentor, Reviewer, Growth Advisor…"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Description</label>
                  <textarea
                    value={newRespDesc}
                    onChange={(e) => setNewRespDesc(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                  />
                </div>
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
                  <button onClick={() => renameResponsibility(r)} className="text-sm font-black text-[var(--text-primary)] hover:text-[var(--brand-orange)]">
                    {r.name}
                  </button>
                  <button
                    onClick={() => toggleResponsibilityActive(r.code, r.is_active)}
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${r.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 font-mono mb-1">{r.code}</p>
                {r.description && <p className="text-xs text-slate-500 mb-2">{r.description}</p>}
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">
                  {r.active_assignments || 0} active assignment{(r.active_assignments || 0) === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
