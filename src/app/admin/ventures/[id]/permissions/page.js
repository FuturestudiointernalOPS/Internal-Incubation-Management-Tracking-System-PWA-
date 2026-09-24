"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Users, Trash2, UserPlus, Save, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Platform roles that represent Future Studio staff/operators — founders,
// participants and investors are never offered for Venture assignments here.
const STAFF_ROLES = new Set([
  "super_admin", "staff", "program_manager",
  "facilitator", "finance", "crm", "team",
]);

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
  const { t } = useI18n();

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

  const notify = (message, type = "success") => {
    setToast({ msg: message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const loadAll = async () => {
      const [ventureResponse, responsibilitiesResponse, scopesResponse, assignmentsResponse] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch("/api/venture-permissions/responsibilities?include_inactive=1"),
        fetch("/api/venture-permissions/scopes"),
        fetch(`/api/ventures/${id}/staff-assignments`),
      ]);
      const ventureData = await ventureResponse.json();
      const responsibilityData = await responsibilitiesResponse.json();
      const scopeData = await scopesResponse.json();
      const assignmentData = await assignmentsResponse.json();
      if (ventureData.success) setVenture(ventureData.venture);
      if (responsibilityData.success) setResponsibilities(responsibilityData.responsibilities || []);
      if (scopeData.success) setScopes(scopeData.scopes || []);
      if (assignmentData.success) setAssignments(assignmentData.assignments || []);
    };

    (async () => {
      try {
        await loadAll();
      } catch (error) {
        console.error("Failed to load staff assignments:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const searchContacts = async (query) => {
    if (!query || query.length < 2) { setContactResults([]); return; }
    setSearching(true);
    try {
      const response = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`);
      const payload = await response.json();
      if (payload.success) {
        // Only Future Studio staff-type contacts may be assigned to a Venture.
        const staffResults = (payload.contacts || []).filter((contact) => STAFF_ROLES.has(contact.role));
        setContactResults(staffResults);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!picked || !form.responsibility_code) {
      notify("Pick a staff member and a responsibility.", "error");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${id}/staff-assignments`, {
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
      const payload = await response.json();
      if (payload.success) {
        notify("Staff member assigned.");
        setShowForm(false);
        setPicked(null);
        setContactQ("");
        setContactResults([]);
        setForm({ responsibility_code: "", scope_type: "venture_wide", scope_ref: "" });
        setAssignments(payload.assignments || []);
      } else {
        notify(payload.error || "Assignment failed.", "error");
      }
    } catch {
      notify("Assignment failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assignmentId) => {
    const response = await fetch(`/api/ventures/${id}/staff-assignments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: assignmentId, action: "remove" }),
    });
    const payload = await response.json();
    if (payload.success) {
      notify("Assignment removed. Staff member no longer accesses this Venture.");
      setAssignments(payload.assignments || []);
    } else {
      notify(payload.error || "Remove failed.", "error");
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
          <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
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
                    onChange={(event) => { setContactQ(event.target.value); searchContacts(event.target.value); }}
                    className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
                    placeholder={t("venture.staffAssign.searchPlaceholder")}
                  />
                  {searching && <p className="text-xs text-slate-500 mt-1">Searching…</p>}
                  {contactResults.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--surface-1)]">
                      {contactResults.map((contact) => (
                        <button type="button" key={contact.cid} onClick={() => { setPicked(contact); setContactResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)]">
                          <span className="font-medium text-[var(--text-primary)]">{contact.name}</span>
                          {contact.role && <span className="ml-2 px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[8px] font-bold uppercase">{contact.role}</span>}
                          {contact.email && <span className="ml-2 text-slate-500">{contact.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!searching && contactQ.length >= 2 && contactResults.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1">{t("venture.staffAssign.noStaffFound")}</p>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Responsibility (global profile)</label>
                <select value={form.responsibility_code} onChange={(event) => setForm({ ...form, responsibility_code: event.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
                  <option value="">Select…</option>
                  {responsibilities.filter((responsibility) => responsibility.is_active).map((responsibility) => (
                    <option key={responsibility.code} value={responsibility.code}>{responsibility.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope</label>
                <select value={form.scope_type} onChange={(event) => setForm({ ...form, scope_type: event.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
                  {scopes.map((scope) => (
                    <option key={scope.code} value={scope.code}>{scope.name}</option>
                  ))}
                </select>
              </div>
              {form.scope_type !== "venture_wide" && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Scope reference (ID)</label>
                  <input value={form.scope_ref} onChange={(event) => setForm({ ...form, scope_ref: event.target.value })} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]" placeholder="e.g. milestone id or section id" />
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
            assignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)]">
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{assignment.staff_name || assignment.staff_contact_id}</p>
                  <p className="text-[10px] text-slate-500">
                    {assignment.responsibility_name || assignment.responsibility_code}
                    {assignment.scope_type !== "venture_wide" && ` · Scope: ${assignment.scope_type}${assignment.scope_ref_id ? ` (${assignment.scope_ref_id})` : ""}`}
                    {assignment.staff_email && ` · ${assignment.staff_email}`}
                  </p>
                </div>
                <button onClick={() => remove(assignment.id)} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-rose-400 border border-rose-500/30 hover:bg-rose-500/10">
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
