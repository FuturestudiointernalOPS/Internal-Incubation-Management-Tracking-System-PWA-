"use client";

import React, { useState, useEffect, use } from "react";
import {
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  Save,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * PM — PROGRAM FACILITATORS
 * Manage external facilitators for this program: assign from the CRM
 * Facilitators pool, configure program-level permissions and participant
 * scope, individual overrides, lead facilitator per participant group,
 * and facilitator reviews (with PM decisions).
 */

const FACILITATOR_CAPS = [
  { key: "participants.view", label: "View participants" },
  { key: "participants.manage", label: "Manage participants" },
  { key: "attendance.view", label: "View attendance" },
  { key: "attendance.record", label: "Record attendance" },
  { key: "assignments.view", label: "View assignments" },
  { key: "assignments.review", label: "Review assignments" },
  { key: "assignments.grade", label: "Grade assignments" },
  { key: "sessions.conduct", label: "Conduct sessions" },
  { key: "sessions.record", label: "Record sessions" },
  { key: "progress.view", label: "View progress" },
  { key: "groups.view", label: "View groups" },
  { key: "groups.manage", label: "Manage groups" },
];

export default function ProgramFacilitators({ params }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const { t } = useI18n();

  const [program, setProgram] = useState(null);
  const [groups, setGroups] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [pool, setPool] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionInputs, setDecisionInputs] = useState({});

  const load = async () => {
    try {
      const progRes = await fetch(`/api/pm/programs/${id}`);
      const progData = await progRes.json();
      if (progData.success) setProgram(progData.program);

      const gRes = await fetch(`/api/v2/groups?program_id=${id}`);
      const gData = await gRes.json();
      if (gData.success) setGroups(gData.groups || []);

      const rRes = await fetch(`/api/facilitator-reviews?program_id=${id}`);
      const rData = await rRes.json();
      if (rData.success) setReviews(rData.reviews || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    fetch(`/api/contacts?group=Facilitators`)
      .then((r) => r.json())
      .then((d) => setPool(d.success ? d.contacts || [] : []))
      .catch(() => setPool([]));
  }, [id]);

  const notify = (type, message) =>
    window.dispatchEvent(
      new CustomEvent("impactos:notify", { detail: { type, message } }),
    );

  const saveProgramConfig = async (patch) => {
    setBusy(true);
    try {
      const res = await fetch("/api/pm/programs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (data.success) {
        setProgram((p) => ({ ...p, ...patch }));
        notify("success", "Saved");
      } else {
        notify("error", data.error || "Save failed");
      }
    } catch (e) {
      notify("error", "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const addFacilitator = async (contact) => {
    setBusy(true);
    try {
      const res = await fetch("/api/v2/program-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          staff_id: contact.cid,
          role: "facilitator",
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify("success", "Facilitator added");
        const progRes = await fetch(`/api/pm/programs/${id}`);
        const progData = await progRes.json();
        if (progData.success) setProgram(progData.program);
      } else {
        notify("error", data.error || "Failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const removeFacilitator = async (f) => {
    const res = await fetch("/api/v2/program-staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id }),
    });
    if ((await res.json()).success) {
      setProgram((p) => ({
        ...p,
        facilitators: (p.facilitators || []).filter((x) => x.id !== f.id),
      }));
      notify("success", "Facilitator removed (CRM record untouched)");
    }
  };

  const toggleOverride = async (f, capKey) => {
    const current = f.permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    const res = await fetch("/api/v2/program-staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, permissions: next }),
    });
    if ((await res.json()).success) {
      setProgram((p) => ({
        ...p,
        facilitators: (p.facilitators || []).map((x) =>
          x.id === f.id ? { ...x, permissions: next } : x,
        ),
      }));
    }
  };

  const toggleDefault = (capKey) => {
    const current = program?.facilitator_default_permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    saveProgramConfig({ facilitator_default_permissions: next });
  };

  const setLead = async (groupId, cid) => {
    const res = await fetch("/api/families", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, lead_facilitator_id: cid || null }),
    });
    if ((await res.json()).success) {
      setGroups((prev) =>
        prev.map((g) =>
          String(g.id) === String(groupId)
            ? { ...g, lead_facilitator_id: cid || null }
            : g,
        ),
      );
      notify("success", "Lead facilitator updated");
    }
  };

  const recordDecision = async (reviewId) => {
    const input = decisionInputs[reviewId] || {};
    const res = await fetch("/api/facilitator-reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: reviewId,
        pm_decision: input.decision || "",
        pm_decision_note: input.note || "",
      }),
    });
    if ((await res.json()).success) {
      notify("success", "Decision recorded");
      load();
    }
  };

  if (!program) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
      </div>
    );
  }

  const defaultPerms = program.facilitator_default_permissions || {};
  const families = groups.filter((g) => g.source === "family");

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <a
              href={`/pm/programs/${id}`}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back to program
            </a>
            <h1 className="text-xl font-black uppercase tracking-tight">
              Facilitators — {program.name}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1">
              External personnel sourced from the CRM. They are not Future
              Studio staff and only access this program.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 border border-[var(--border-primary)]">
            <UserCheck className="w-4 h-4 text-[var(--brand-orange)]" />
            <span className="text-[10px] font-black uppercase">
              {(program.facilitators || []).length} assigned
            </span>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Participant Scope
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => saveProgramConfig({ facilitator_scope: "assigned_groups" })}
              className={`p-4 rounded-2xl border text-left transition-all ${program.facilitator_scope !== "all" ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
            >
              <p className="text-[10px] font-black uppercase">Assigned Groups Only</p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                Facilitators see participants in their assigned groups only.
              </p>
            </button>
            <button
              onClick={() => saveProgramConfig({ facilitator_scope: "all" })}
              className={`p-4 rounded-2xl border text-left transition-all ${program.facilitator_scope === "all" ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
            >
              <p className="text-[10px] font-black uppercase">All Participants</p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                Facilitators can see the entire program.
              </p>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Default Facilitator Permissions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FACILITATOR_CAPS.map((cap) => {
              const active = !!defaultPerms[cap.key];
              return (
                <button
                  key={cap.key}
                  onClick={() => toggleDefault(cap.key)}
                  className={`p-3 rounded-xl border text-left text-[9px] font-black uppercase transition-all ${active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
                >
                  {cap.label}
                  {active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Assigned Facilitators
          </h2>
          <div className="space-y-3">
            {(program.facilitators || []).map((f) => (
              <div key={f.id} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase truncate">{f.name}</p>
                    <p className="text-[9px] text-[var(--text-secondary)] truncate">{f.email}</p>
                  </div>
                  <button
                    onClick={() => removeFacilitator(f)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 hover:underline shrink-0"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-2">
                    Individual overrides (this facilitator only)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {FACILITATOR_CAPS.map((cap) => {
                      const active = !!(f.permissions || {})[cap.key];
                      return (
                        <button
                          key={cap.key}
                          onClick={() => toggleOverride(f, cap.key)}
                          className={`p-2 rounded-lg border text-left text-[8px] font-black uppercase truncate transition-all ${active ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
                        >
                          {cap.label}
                          {active ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            {(program.facilitators || []).length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-4 text-center">
                No facilitators assigned yet.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Add From CRM — Facilitators Group
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {pool
              .filter((c) => !(program.facilitators || []).some((f) => f.cid === c.cid))
              .filter(
                (c) =>
                  !search ||
                  (c.name || "").toLowerCase().includes(search.toLowerCase()) ||
                  (c.email || "").toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.cid}
                  disabled={busy}
                  onClick={() => addFacilitator(c)}
                  className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
                >
                  <span className="text-[10px] font-black uppercase truncate">{c.name}</span>
                  <span className="text-[9px] text-[var(--text-secondary)] truncate">{c.email}</span>
                  <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                </button>
              ))}
            {pool.length === 0 && (
              <p className="text-[9px] italic text-[var(--text-secondary)]">
                No contacts in the CRM "Facilitators" group yet.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Lead Facilitator Per Participant Group
          </h2>
          <div className="space-y-2">
            {families.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-secondary">
                <span className="text-[10px] font-black uppercase truncate">{g.name}</span>
                <select
                  value={g.lead_facilitator_id || ""}
                  onChange={(e) => setLead(g.id, e.target.value || null)}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none cursor-pointer max-w-[45%]"
                >
                  <option value="">— None —</option>
                  {(program.facilitators || []).map((f) => (
                    <option key={f.cid} value={f.cid}>{f.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {families.length === 0 && (
              <p className="text-[9px] italic text-[var(--text-secondary)]">
                No participant groups linked to this program yet.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Facilitator Reviews
          </h2>
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-4 text-center">
                No reviews submitted yet.
              </p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[var(--brand-orange)]" />
                    <p className="text-[10px] font-black uppercase">
                      {r.facilitator_name || r.facilitator_id}
                    </p>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${r.status === "decided" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                    {r.status}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-[9px]">
                  {r.participant_progress && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Progress:</strong> {r.participant_progress}</p>}
                  {r.attendance_concerns && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Attendance:</strong> {r.attendance_concerns}</p>}
                  {r.assignment_performance && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Assignments:</strong> {r.assignment_performance}</p>}
                  {r.challenges && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Challenges:</strong> {r.challenges}</p>}
                  {r.participants_needing_intervention && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Intervention:</strong> {r.participants_needing_intervention}</p>}
                  {r.recommendations && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Recommendations:</strong> {r.recommendations}</p>}
                </div>
                {r.pm_decision ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
                      PM Decision — {r.pm_decision_by || "PM"}
                    </p>
                    <p className="text-[9px] text-[var(--text-primary)]">{r.pm_decision}</p>
                    {r.pm_decision_note && (
                      <p className="text-[9px] text-[var(--text-secondary)] mt-1">{r.pm_decision_note}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={decisionInputs[r.id]?.decision || ""}
                      onChange={(e) =>
                        setDecisionInputs({
                          ...decisionInputs,
                          [r.id]: { ...decisionInputs[r.id], decision: e.target.value },
                        })
                      }
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-2 text-[9px] font-bold outline-none cursor-pointer"
                    >
                      <option value="">— Select decision —</option>
                      <option value="Acknowledged">Acknowledged</option>
                      <option value="Action taken">Action taken</option>
                      <option value="Needs follow-up">Needs follow-up</option>
                      <option value="Escalated to Super Admin">Escalated to Super Admin</option>
                    </select>
                    <textarea
                      value={decisionInputs[r.id]?.note || ""}
                      onChange={(e) =>
                        setDecisionInputs({
                          ...decisionInputs,
                          [r.id]: { ...decisionInputs[r.id], note: e.target.value },
                        })
                      }
                      placeholder="PM action note…"
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
                    />
                    <button
                      onClick={() => recordDecision(r.id)}
                      className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-400 hover:underline"
                    >
                      <Save className="w-3.5 h-3.5" /> Record decision
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
