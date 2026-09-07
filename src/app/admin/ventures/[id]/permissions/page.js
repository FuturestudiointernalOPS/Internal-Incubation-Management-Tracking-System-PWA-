"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Users, Trash2, UserPlus, Save, X } from "lucide-react";

/**
 * Super Admin → Ventures → [Venture] → Staff Assignments
 *
 * The ONLY per-Venture access data is WHO is assigned, with WHICH
 * responsibility (global profile) and WHAT scope. The permission matrix
 * itself is global — configure it under Ventures → Permissions.
 */
export default function VentureStaffAssignmentsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [venture, setVenture] = useState(null);
  const [responsibilities, setResponsibilities] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactQ, setContactQ] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);
  const [form, setForm] = useState({ responsibility_code: "", scope_type: "venture_wide", scope_ref: "" });

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = async () => {
    const [v, r, s, a] = await Promise.all([
      fetch(`/api/ventures/${id}`),
      fetch("/api/venture-permissions/responsibilities?include_inactive=1"),
      fetch("/api/venture-permissions/scopes"),
      fetch(`/api/ventures/${id}/staff-assignments`),
    ]);
    const vd = await v.json();
    const rd = await r.json();
    const sd = await s.json();
    const ad = await a.json();
    if (vd.success) setVenture(vd.venture);
    if (rd.success) setResponsibilities(rd.responsibilities || []);
    if (sd.success) setScopes(sd.scopes || []);
    if (ad.success) setAssignments(ad.assignments || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await loadAll();
      } catch (e) {
        console.error("Failed to load staff assignments:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const searchContacts = async (q) => {
    if (!q || q.length < 2) { setContactResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (d.success) setContactResults(d.contacts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!picked || !form.responsibility_code) {
      notify("Pick a staff member and a responsibility.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/staff-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_contact_id: picked.cid,
          responsibility_code: form.responsibility_code,
          scope_type: form.scope_type,
          scope_ref_type: form.scope_type !== "venture_wide" ? form.scope_type : null,
          scope_ref_id: form.scope_type !== "venture_wide" ? (form.scope_ref || null) : null,
        }),
      });
      const d = await res.json();
      if (d.success) {
        notify("Staff member assigned.");
        setShowForm(false);
        setPicked(null);
        setContactQ("");
        setContactResults([]);
        setForm({ responsibility_code: "", scope_type: "venture_wide", scope_ref: "" });
        setAssignments(d.assignments || []);
      } else {
        notify(d.error || "Assignment failed.", "error");
      }
    } catch (err) {
      notify("Assignment failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assignmentId) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--text-primary)]">Staff Assignments</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {venture?.company_name} · {venture?.venture_id} — who manages/coaches this Venture and at what scope
            </p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-3">
          Permission profiles are GLOBAL — configure them under Ventures → Permissions. Here you only bind people to this Venture.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assigned staff ({assignments.length})</h3>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
            {showForm ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />} {showForm ? "Cancel" : "Assign Staff"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="mt-5 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-4">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Find staff member</label>
              {picked ? (
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-primary)]">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{picked.name}</p>
                    <p className="text-[10px] text-slate-500">{picked.email || picked.cid}</p>
                  </div>
                  <button type="button" onClick={() => { setPicked(null); setContactQ(""); }} className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1">
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
                  {searching && <p className="text-xs text-slate-500 mt-1">Searching…</p>}
                  {contactResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)]">
                      {contactResults.map((c) => (
                        <button type="button" key={c.cid} onClick={() => { setPicked(c); setContactResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
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
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Responsibility (global profile)</label>
                <select value={form.responsibility_code} onChange={(e) => setForm({ ...form, responsibility_code: e.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
                  <option value="">Select…</option>
                  {responsibilities.filter((r) => r.is_active).map((r) => (
                    <option key={r.code} value={r.code}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope</label>
                <select value={form.scope_type} onChange={(e) => setForm({ ...form, scope_type: e.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
                  {scopes.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
              {form.scope_type !== "venture_wide" && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope reference (ID)</label>
                  <input value={form.scope_ref} onChange={(e) => setForm({ ...form, scope_ref: e.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" placeholder="e.g. milestone id or section id" />
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Assign
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 space-y-2">
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-500">No staff assigned yet. Staff gain Venture access only through assignments.</p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{a.staff_name || a.staff_contact_id}</p>
                  <p className="text-[10px] text-slate-500">
                    {a.responsibility_name || a.responsibility_code}
                    {a.scope_type !== "venture_wide" && ` · Scope: ${a.scope_type}${a.scope_ref_id ? ` (${a.scope_ref_id})` : ""}`}
                    {a.staff_email && ` · ${a.staff_email}`}
                  </p>
                </div>
                <button onClick={() => remove(a.id)} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
