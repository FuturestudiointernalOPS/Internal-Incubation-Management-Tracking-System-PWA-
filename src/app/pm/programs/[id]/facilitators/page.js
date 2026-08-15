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
  ShieldCheck,
  Mail,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * PM — PROGRAM FACILITATORS
 * The program's system-defined Facilitators group. The system maintains the
 * group; the PM manages the people inside it: search any contact by name or
 * email, invite people without accounts, configure program-level permissions,
 * participant scope, individual overrides, lead facilitator per participant
 * group, and facilitator reviews (with PM decisions).
 */

const FACILITATOR_CAPS = [
  { key: "participants.view", label: "pmMisc.facilitators.caps.viewParticipants" },
  { key: "participants.manage", label: "pmMisc.facilitators.caps.manageParticipants" },
  { key: "attendance.view", label: "pmMisc.facilitators.caps.viewAttendance" },
  { key: "attendance.record", label: "pmMisc.facilitators.caps.recordAttendance" },
  { key: "assignments.view", label: "pmMisc.facilitators.caps.viewAssignments" },
  { key: "assignments.review", label: "pmMisc.facilitators.caps.reviewAssignments" },
  { key: "assignments.grade", label: "pmMisc.facilitators.caps.gradeAssignments" },
  { key: "sessions.conduct", label: "pmMisc.facilitators.caps.conductSessions" },
  { key: "sessions.record", label: "pmMisc.facilitators.caps.recordSessions" },
  { key: "progress.view", label: "pmMisc.facilitators.caps.viewProgress" },
  { key: "groups.view", label: "pmMisc.facilitators.caps.viewGroups" },
  { key: "groups.manage", label: "pmMisc.facilitators.caps.manageGroups" },
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
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });
  const [facilitatorsGroup, setFacilitatorsGroup] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [conflictError, setConflictError] = useState(null);

  const load = async () => {
    try {
      const progRes = await fetch(`/api/pm/programs/${id}`);
      const progData = await progRes.json();
      if (progData.success) setProgram(progData.program);

      const gRes = await fetch(`/api/v2/groups?program_id=${id}`);
      const gData = await gRes.json();
      if (gData.success) {
        setGroups(gData.groups || []);
        setFacilitatorsGroup(
          (gData.groups || []).find((g) => g.type === "facilitators" || String(g.name).toUpperCase() === "FACILITATORS") || null,
        );
      }

      const rRes = await fetch(`/api/facilitator-reviews?program_id=${id}`);
      const rData = await rRes.json();
      if (rData.success) setReviews(rData.reviews || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
    // Search ALL contacts (the CRM is the source of people — no global group required)
    fetch(`/api/contacts`)
      .then((r) => r.json())
      .then((d) => setPool(d.success ? d.contacts || [] : []))
      .catch(() => setPool([]));

    // Participants of THIS program — excluded from the facilitator search to
    // enforce the "no participant + facilitator in the same program" rule.
    fetch(`/api/participants?program_id=${id}`)
      .then((r) => r.json())
      .then((d) => setParticipants(d.success ? d.participants || [] : []))
      .catch(() => setParticipants([]));
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
        notify("success", t("pmMisc.facilitators.saved"));
      } else {
        notify("error", data.error || t("pmMisc.facilitators.saveFailed"));
      }
    } catch (e) {
      notify("error", t("pmMisc.facilitators.saveFailed"));
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
        setConflictError(null);
        notify("success", t("pmMisc.facilitators.addedToProgram"));
        const progRes = await fetch(`/api/pm/programs/${id}`);
        const progData = await progRes.json();
        if (progData.success) setProgram(progData.program);
      } else {
        if (data.error === "errors.roleConflictParticipantFacilitator") {
          setConflictError({ name: contact.name || contact.email, email: contact.email || "" });
        } else {
          notify("error", t(data.error) || data.error || t("pmMisc.facilitators.failed"));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const createAndInviteFacilitator = async () => {
    const email = inviteForm.email.trim();
    if (!email) {
      notify("error", t("pmMisc.facilitators.emailRequired"));
      return;
    }
    const fallbackName = email.split("@")[0];
    setBusy(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: inviteForm.name.trim() || fallbackName,
          role: "facilitator",
          program_id: id,
          program_name: program?.name || "", 
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.cid) {
          await addFacilitator({
            cid: data.cid,
            name: inviteForm.name.trim() || fallbackName,
            email,
          });
        }
        setInviteForm({ name: "", email: "" });
        notify("success", t("pmMisc.facilitators.invitationSent"));
      } else {
        notify("error", data.error || t("pmMisc.facilitators.inviteFailed"));
      }
    } catch (e) {
      notify("error", t("pmMisc.facilitators.inviteFailed"));
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
      notify("success", t("pmMisc.facilitators.removedFromProgram"));
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
      notify("success", t("pmMisc.facilitators.leadUpdated"));
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
      notify("success", t("pmMisc.facilitators.decisionRecorded"));
      load();
    }
  };

  const reviewStatusLabel = (status) => {
    if (status === "decided") return t("pmMisc.facilitators.statusDecided");
    if (status === "submitted") return t("pmMisc.facilitators.statusSubmitted");
    return status || "";
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
  const assignedCids = (program.facilitators || []).map((f) => f.cid);
  const participantKeys = new Set((participants || []).flatMap((p) => [p.cid, p.email].filter(Boolean)));

  return (
    <DashboardLayout role="program_manager" activeTab="v2">
      <div className="max-w-5xl mx-auto space-y-8 p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <a
              href={`/pm/programs/${id}`}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--brand-orange)] mb-2"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.backToProgram")}
            </a>
            <h1 className="text-xl font-black uppercase tracking-tight">
              {t("pmMisc.facilitators.title", { name: program.name })}
            </h1>
            <p className="text-[10px] text-[var(--text-secondary)] font-bold mt-1">
              {t("pmMisc.facilitators.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 border border-[var(--border-primary)]">
            <UserCheck className="w-4 h-4 text-[var(--brand-orange)]" />
            <span className="text-[10px] font-black uppercase">
              {t("pmMisc.facilitators.assignedCount", { count: (program.facilitators || []).length })}
            </span>
          </div>
        </header>

        {/* System-defined group banner */}
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase text-blue-400">
              {t("pmMisc.facilitators.systemGroupLabel")}
            </p>
            <p className="text-[9px] text-[var(--text-secondary)]">
              {t("pmMisc.facilitators.systemGroupDescription")}
            </p>
          </div>
        </div>

        {/* Add facilitator */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.addSectionTitle")}
          </h2>
          {conflictError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <p className="text-[9px] font-black uppercase text-rose-400">{t("errors.roleConflictParticipantFacilitator")}</p>
              <a
                href={`mailto:info@futurestudio.bj?subject=${encodeURIComponent(t("pmMisc.facilitators.conflictSubject", { program: program?.name || id }))}&body=${encodeURIComponent(t("pmMisc.facilitators.conflictBody", { name: conflictError.name, email: conflictError.email, program: program?.name || id }))}`}
                className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-[var(--brand-orange)] hover:underline"
              >
                <Mail className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.contactSupport")}
              </a>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("pmMisc.facilitators.searchPlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {pool
              .filter((c) => !assignedCids.includes(c.cid))
              .filter((c) => !participantKeys.has(c.cid) && !participantKeys.has(c.email))
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
                {t("pmMisc.facilitators.noContacts")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
              placeholder={t("pmMisc.facilitators.nameOptional")}
              className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
            />
            <input
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              placeholder={t("pmMisc.facilitators.emailPlaceholder")}
              className="bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
          <button
            disabled={busy}
            onClick={createAndInviteFacilitator}
            className="flex items-center gap-2 text-[9px] font-black uppercase px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 transition-all"
          >
            <Mail className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.createInvite")}
          </button>
        </section>

        {/* Participant scope */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.participantScope")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => saveProgramConfig({ facilitator_scope: "assigned_groups" })}
              className={`p-4 rounded-2xl border text-left transition-all ${program.facilitator_scope !== "all" ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
            >
              <p className="text-[10px] font-black uppercase">{t("pmMisc.facilitators.assignedGroupsOnly")}</p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                {t("pmMisc.facilitators.assignedGroupsDesc")}
              </p>
            </button>
            <button
              onClick={() => saveProgramConfig({ facilitator_scope: "all" })}
              className={`p-4 rounded-2xl border text-left transition-all ${program.facilitator_scope === "all" ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
            >
              <p className="text-[10px] font-black uppercase">{t("pmMisc.facilitators.allParticipants")}</p>
              <p className="text-[9px] text-[var(--text-secondary)] mt-1">
                {t("pmMisc.facilitators.allParticipantsDesc")}
              </p>
            </button>
          </div>
        </section>

        {/* Default permissions */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.defaultPermissions")}
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
                  {t(cap.label)}
                  {active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
        </section>

        {/* Assigned facilitators */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.assignedFacilitators")}
          </h2>
          <div className="space-y-3">
            {(program.facilitators || []).map((f) => (
              <div key={f.id} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase truncate">{f.name || f.email || f.cid}</p>
                    <p className="text-[9px] text-[var(--text-secondary)] truncate">{f.email && f.email !== f.name ? f.email : ""}</p>
                  </div>
                  <button
                    onClick={() => removeFacilitator(f)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase text-rose-400 hover:underline shrink-0"
                  >
                    <Trash2 className="w-3 h-3" /> {t("pmMisc.facilitators.remove")}
                  </button>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-2">
                    {t("pmMisc.facilitators.individualOverrides")}
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
                          {t(cap.label)}
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
                {t("pmMisc.facilitators.noneAssigned")}
              </p>
            )}
          </div>
        </section>

        {/* Lead facilitator per group */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.leadPerGroup")}
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
                  <option value="">{t("pmMisc.facilitators.noneOption")}</option>
                  {(program.facilitators || []).map((f) => (
                    <option key={f.cid} value={f.cid}>{f.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {families.length === 0 && (
              <p className="text-[9px] italic text-[var(--text-secondary)]">
                {t("pmMisc.facilitators.noGroups")}
              </p>
            )}
          </div>
        </section>

        {/* Reviews */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.reviews")}
          </h2>
          <div className="space-y-3">
            {reviews.length === 0 && (
              <p className="text-[10px] italic text-[var(--text-secondary)] py-4 text-center">
                {t("pmMisc.facilitators.noReviews")}
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
                    {reviewStatusLabel(r.status)}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-[9px]">
                  {r.participant_progress && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.progressLabel")}</strong> {r.participant_progress}</p>}
                  {r.attendance_concerns && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.attendanceLabel")}</strong> {r.attendance_concerns}</p>}
                  {r.assignment_performance && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.assignmentsLabel")}</strong> {r.assignment_performance}</p>}
                  {r.challenges && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.challengesLabel")}</strong> {r.challenges}</p>}
                  {r.participants_needing_intervention && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.interventionLabel")}</strong> {r.participants_needing_intervention}</p>}
                  {r.recommendations && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.recommendationsLabel")}</strong> {r.recommendations}</p>}
                </div>
                {r.pm_decision ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
                      {t("pmMisc.facilitators.pmDecision", { pm: r.pm_decision_by || t("pmMisc.facilitators.pmShort") })}
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
                      <option value="">{t("pmMisc.facilitators.selectDecision")}</option>
                      <option value="Acknowledged">{t("pmMisc.facilitators.decisionAcknowledged")}</option>
                      <option value="Action taken">{t("pmMisc.facilitators.decisionActionTaken")}</option>
                      <option value="Needs follow-up">{t("pmMisc.facilitators.decisionNeedsFollowUp")}</option>
                      <option value="Escalated to Super Admin">{t("pmMisc.facilitators.decisionEscalated")}</option>
                    </select>
                    <textarea
                      value={decisionInputs[r.id]?.note || ""}
                      onChange={(e) =>
                        setDecisionInputs({
                          ...decisionInputs,
                          [r.id]: { ...decisionInputs[r.id], note: e.target.value },
                        })
                      }
                      placeholder={t("pmMisc.facilitators.pmActionNote")}
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
                    />
                    <button
                      onClick={() => recordDecision(r.id)}
                      className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-400 hover:underline"
                    >
                      <Save className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.recordDecision")}
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
