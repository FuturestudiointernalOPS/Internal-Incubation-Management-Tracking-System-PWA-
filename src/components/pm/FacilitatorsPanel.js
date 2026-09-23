"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  UserCheck,
  ClipboardList,
  ShieldCheck,
  Mail,
  X,
  Send,
  Check,
  RotateCcw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

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

const FULL_FACILITATOR_PERMISSIONS = FACILITATOR_CAPS.reduce((permissions, cap) => {
  permissions[cap.key] = cap.key.startsWith("view") ? 1 : 2;
  return permissions;
}, {});

// Stable read shapes: one shaper per answer, made once here rather than rebuilt
// on every render.
const pickProgram = (payload) => (payload?.success ? payload.program ?? null : null);
const pickGroups = (payload) => (payload?.success ? payload.groups || [] : []);
const pickReviews = (payload) => (payload?.success ? payload.reviews || [] : []);
const pickContacts = (payload) => (payload?.success ? payload.contacts || [] : []);
const pickParticipants = (payload) => (payload?.success ? payload.participants || [] : []);

export function FacilitatorsPanel({ programId }) {
  const id = programId;
  const { t } = useI18n();

  // The panel's reads go through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the panel keeps no
  // copy of its own and reads during render.
  const { data: program, refresh: refreshProgram, setData: setProgram } = useApi(
    `/api/pm/programs/${id}`,
    { defaultValue: null, transform: pickProgram },
  );
  const { data: groups, refresh: refreshGroups, setData: setGroups } = useApi(
    `/api/v2/groups?program_id=${id}`,
    { defaultValue: [], transform: pickGroups },
  );
  const { data: reviews, refresh: refreshReviews } = useApi(
    `/api/facilitator-reviews?program_id=${id}`,
    { defaultValue: [], transform: pickReviews },
  );
  // Search ALL contacts (the CRM is the source of people — no global group required)
  const { data: pool, refresh: refreshContacts } = useApi("/api/contacts", {
    defaultValue: [],
    transform: pickContacts,
  });
  // Participants of THIS program — excluded from the facilitator search to
  // enforce the "no participant + facilitator in the same program" rule.
  const { data: participants, refresh: refreshParticipants } = useApi(
    `/api/participants?program_id=${id}`,
    { defaultValue: [], transform: pickParticipants },
  );

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionInputs, setDecisionInputs] = useState({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [invitePreview, setInvitePreview] = useState([]);
  const [inviteResults, setInviteResults] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Every read the hand-written loader re-read, refreshed together: the invite
  // batch and the PM decision below still reload the same five answers.
  const reloadAll = () =>
    Promise.all([
      refreshProgram(),
      refreshGroups(),
      refreshReviews(),
      refreshContacts(),
      refreshParticipants(),
    ]);

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
        setProgram((previousProgram) => ({ ...previousProgram, ...patch }));
        notify("success", t("pmMisc.facilitators.saved"));
      } else {
        notify("error", data.error || t("pmMisc.facilitators.saveFailed"));
      }
    } catch {
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
          permissions:
            program?.facilitator_default_permissions &&
            Object.keys(program.facilitator_default_permissions).length > 0
              ? program.facilitator_default_permissions
              : FULL_FACILITATOR_PERMISSIONS,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConflictError(null);
        notify("success", t("pmMisc.facilitators.addedToProgram"));
        await refreshProgram();
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

  const parseInviteEmails = () => {
    return Array.from(
      new Set(
        inviteEmails
          .split(/[\n,;]+/)
          .map((email) => email.trim())
          .filter(Boolean),
      ),
    );
  };

  const openInviteModal = () => {
    setShowInviteModal(true);
    setInviteEmails("");
    setInvitePreview([]);
    setInviteResults(null);
  };

  const handlePreviewInvites = async () => {
    const emails = parseInviteEmails();
    if (emails.length === 0) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/facilitators/invite-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          program_name: program?.name || "",
          emails,
          preview: true,
        }),
      });
      const data = await res.json();
      if (data.success) setInvitePreview(data.results || []);
    } catch {
      notify("error", t("pmMisc.facilitators.inviteFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleInviteAll = async () => {
    const emails = parseInviteEmails();
    if (emails.length === 0) return;
    setInviting(true);
    try {
      const res = await fetch("/api/facilitators/invite-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          program_name: program?.name || "",
          emails,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInviteResults(data.results || []);
        await reloadAll();
      } else {
        notify("error", data.error || t("pmMisc.facilitators.inviteFailed"));
      }
    } catch {
      notify("error", t("pmMisc.facilitators.inviteFailed"));
    } finally {
      setInviting(false);
    }
  };

  const removeFacilitator = async (facilitator) => {
    const res = await fetch("/api/v2/program-staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: facilitator.id }),
    });
    if ((await res.json()).success) {
      setProgram((previousProgram) => ({
        ...previousProgram,
        facilitators: (previousProgram.facilitators || []).filter((candidate) => candidate.id !== facilitator.id),
      }));
      notify("success", t("pmMisc.facilitators.removedFromProgram"));
    }
  };

  const toggleOverride = async (facilitator, capKey) => {
    const current = facilitator.permissions || {};
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    const res = await fetch("/api/v2/program-staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: facilitator.id, permissions: next }),
    });
    if ((await res.json()).success) {
      setProgram((previousProgram) => ({
        ...previousProgram,
        facilitators: (previousProgram.facilitators || []).map((candidate) =>
          candidate.id === facilitator.id ? { ...candidate, permissions: next } : candidate,
        ),
      }));
    }
  };

  const toggleDefault = (capKey) => {
    const current =
      program?.facilitator_default_permissions &&
      Object.keys(program.facilitator_default_permissions).length > 0
        ? program.facilitator_default_permissions
        : FULL_FACILITATOR_PERMISSIONS;
    const next = { ...current };
    if (next[capKey]) delete next[capKey];
    else next[capKey] = capKey.startsWith("view") ? 1 : 2;
    saveProgramConfig({ facilitator_default_permissions: next });
  };

  const setLead = async (groupId, facilitatorCid) => {
    const res = await fetch("/api/families", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, lead_facilitator_id: facilitatorCid || null }),
    });
    if ((await res.json()).success) {
      setGroups((prev) =>
        prev.map((group) =>
          String(group.id) === String(groupId)
            ? { ...group, lead_facilitator_id: facilitatorCid || null }
            : group,
        ),
      );
      notify("success", t("pmMisc.facilitators.leadUpdated"));
    }
  };

  const recordDecision = async (reviewId, decision) => {
    const input = decisionInputs[reviewId] || {};
    const res = await fetch("/api/facilitator-reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: reviewId,
        pm_decision: decision,
        pm_decision_note: input.note || "",
      }),
    });
    if ((await res.json()).success) {
      notify("success", t("pmMisc.facilitators.decisionRecorded"));
      reloadAll();
    }
  };

  const reviewStatusLabel = (review) => {
    if (review?.pm_decision === "changes_requested")
      return t("pmMisc.facilitators.weeklyReview.status_changes_requested");
    if (review?.status === "decided")
      return t("pmMisc.facilitators.weeklyReview.status_decided");
    return t("pmMisc.facilitators.weeklyReview.status_submitted");
  };

  const reviewRatingLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.ratings.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.rating_${value}`)
      : value || "";
  const reviewEngagementLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.engagement.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.engagement_${value}`)
      : value || "";
  const reviewAttentionLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.attention.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.attention_${value}`)
      : value || "";

  if (!program) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF6600]/20 border-t-[#FF6600] rounded-full animate-spin" />
      </div>
    );
  }

  const defaultPerms =
    program.facilitator_default_permissions &&
    Object.keys(program.facilitator_default_permissions).length > 0
      ? program.facilitator_default_permissions
      : FULL_FACILITATOR_PERMISSIONS;
  const families = groups.filter((group) => group.source === "family");
  const assignedCids = (program.facilitators || []).map((facilitator) => facilitator.cid);
  const participantKeys = new Set((participants || []).flatMap((participant) => [participant.cid, participant.email].filter(Boolean)));

  const filteredPool = pool
    .filter((contact) => !assignedCids.includes(contact.cid))
    .filter((contact) => !participantKeys.has(contact.cid) && !participantKeys.has(contact.email))
    .filter(
      (contact) =>
        !search ||
        (contact.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (contact.email || "").toLowerCase().includes(search.toLowerCase()),
    );

  return (
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
          <div className="flex items-center gap-2">
            <button
              onClick={openInviteModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
            >
              <Send className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.inviteFacilitators")}
            </button>
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2 border border-[var(--border-primary)]">
              <UserCheck className="w-4 h-4 text-[var(--brand-orange)]" />
              <span className="text-[10px] font-black uppercase">
                {t("pmMisc.facilitators.assignedCount", { count: (program.facilitators || []).length })}
              </span>
            </div>
          </div>
        </header>

        {/* System-defined group banner */}
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              {t("pmMisc.facilitators.systemGroupLabel")}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400">{t("errors.roleConflictParticipantFacilitator")}</p>
              <a
                href={`mailto:info@futurestudio.bj?subject=${encodeURIComponent(t("pmMisc.facilitators.conflictSubject", { program: program?.name || id }))}&body=${encodeURIComponent(t("pmMisc.facilitators.conflictBody", { name: conflictError.name, email: conflictError.email, program: program?.name || id }))}`}
                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
              >
                <Mail className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.contactSupport")}
              </a>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("pmMisc.facilitators.searchPlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl pl-10 pr-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {filteredPool.map((contact) => (
              <button
                key={contact.cid}
                disabled={busy}
                onClick={() => addFacilitator(contact)}
                className="w-full flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-[var(--border-primary)] hover:border-[var(--brand-orange)] text-left transition-all"
              >
                <span className="text-[10px] font-bold uppercase truncate">{contact.name}</span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{contact.email}</span>
                <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              </button>
            ))}
            {search.trim() && filteredPool.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
                {t("pmMisc.facilitators.noContacts")}
              </p>
            )}
          </div>

          <p className="text-sm text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.inviteHint")}
          </p>
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
              <p className="text-[11px] font-bold uppercase tracking-wide">{t("pmMisc.facilitators.assignedGroupsOnly")}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {t("pmMisc.facilitators.assignedGroupsDesc")}
              </p>
            </button>
            <button
              onClick={() => saveProgramConfig({ facilitator_scope: "all" })}
              className={`p-4 rounded-2xl border text-left transition-all ${program.facilitator_scope === "all" ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]" : "bg-secondary border-[var(--border-primary)]"}`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide">{t("pmMisc.facilitators.allParticipants")}</p>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
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
            {FACILITATOR_CAPS.map((capability) => {
              const active = !!defaultPerms[capability.key];
              return (
                <button
                  key={capability.key}
                  onClick={() => toggleDefault(capability.key)}
                  className={`p-3 rounded-xl border text-left text-[10px] font-bold uppercase transition-all ${active ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
                >
                  {t(capability.label)}
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
            {(program.facilitators || []).map((facilitator) => (
              <div key={facilitator.id} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase truncate">{facilitator.name || facilitator.email || facilitator.cid}</p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{facilitator.email && facilitator.email !== facilitator.name ? facilitator.email : ""}</p>
                  </div>
                  <button
                    onClick={() => removeFacilitator(facilitator)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-400 hover:underline shrink-0"
                  >
                    <Trash2 className="w-3 h-3" /> {t("pmMisc.facilitators.remove")}
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                    {t("pmMisc.facilitators.individualOverrides")}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {FACILITATOR_CAPS.map((capability) => {
                      const active = !!(facilitator.permissions || {})[capability.key];
                      return (
                        <button
                          key={capability.key}
                          onClick={() => toggleOverride(facilitator, capability.key)}
                          className={`p-2 rounded-lg border text-left text-[10px] font-bold uppercase truncate transition-all ${active ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
                        >
                          {t(capability.label)}
                          {active ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            {(program.facilitators || []).length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
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
            {families.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-secondary">
                <span className="text-[10px] font-black uppercase truncate">{group.name}</span>
                <select
                  value={group.lead_facilitator_id || ""}
                  onChange={(event) => setLead(group.id, event.target.value || null)}
                  className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer max-w-[45%]"
                >
                  <option value="">{t("pmMisc.facilitators.noneOption")}</option>
                  {(program.facilitators || []).map((facilitator) => (
                    <option key={facilitator.cid} value={facilitator.cid}>{facilitator.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {families.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">
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
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
                {t("pmMisc.facilitators.noReviews")}
              </p>
            )}
            {reviews.map((review) => (
              <div key={review.id} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-[var(--brand-orange)]" />
                    <p className="text-[11px] font-bold uppercase tracking-wide">
                      {review.facilitator_name || review.facilitator_id}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    review.pm_decision === "changes_requested"
                      ? "bg-rose-500/15 text-rose-400"
                      : review.status === "decided"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                  }`}>
                    {reviewStatusLabel(review)}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-[10px]">
                  {(review.overall_rating || review.participant_progress) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.overall")}</strong> {reviewRatingLabel(review.overall_rating) || review.participant_progress}</p>}
                  {review.engagement && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.engagement")}</strong> {reviewEngagementLabel(review.engagement)}</p>}
                  {(review.went_well || review.completed_work) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.wentWell")}</strong> {review.went_well || review.completed_work}</p>}
                  {(review.struggles || review.challenges) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.struggles")}</strong> {review.struggles || review.challenges}</p>}
                  {(review.needs_attention_type || review.needs_attention || review.needs_attention_note) && <div className="text-[var(--text-secondary)]"><p><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.needsAttention")}</strong> {reviewAttentionLabel(review.needs_attention_type) || review.needs_attention}</p>{review.needs_attention_note && <p className="mt-0.5 pl-1">{review.needs_attention_note}</p>}</div>}
                  {(review.focus_next_week || review.recommendations) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.focusNextWeek")}</strong> {review.focus_next_week || review.recommendations}</p>}
                  {review.additional_notes && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.additionalNotes")}</strong> {review.additional_notes}</p>}
                </div>
                {review.pm_decision ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
                      {t("pmMisc.facilitators.pmDecision", { pm: review.pm_decision_by || t("pmMisc.facilitators.pmShort") })}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">{review.pm_decision}</p>
                    {review.pm_decision_note && (
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{review.pm_decision_note}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={decisionInputs[review.id]?.note || ""}
                      onChange={(event) =>
                        setDecisionInputs({
                          ...decisionInputs,
                          [review.id]: { ...decisionInputs[review.id], note: event.target.value },
                        })
                      }
                      placeholder={t("pmMisc.facilitators.pmActionNote")}
                      rows={2}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => recordDecision(review.id, "acknowledged")}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      >
                        <Check className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.weeklyReview.acknowledge")}
                      </button>
                      <button
                        onClick={() => recordDecision(review.id, "changes_requested")}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.weeklyReview.requestChanges")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Invite Facilitators modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-[var(--text-primary)] tracking-tight">{t("pmMisc.facilitators.inviteModalTitle")}</h2>
                <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">{t("pmMisc.facilitators.inviteModalDescription")}</p>
              <textarea
                value={inviteEmails}
                onChange={(event) => setInviteEmails(event.target.value)}
                placeholder={t("pmMisc.facilitators.inviteEmailsPlaceholder")}
                rows={5}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-3 py-3 text-[11px] font-bold outline-none focus:border-[var(--brand-orange)] resize-y"
              />
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handlePreviewInvites}
                  disabled={previewing || !parseInviteEmails().length}
                  className="px-3 py-2 rounded-lg bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                >
                  {t("pmMisc.facilitators.review")}
                </button>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] text-right">
                  {t("pmMisc.facilitators.defaultAccess")} <strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.fullAccess")}</strong>
                </p>
              </div>

              {invitePreview.length > 0 && !inviteResults && (
                <div className="space-y-2">
                  {invitePreview.map((result) => (
                    <div key={result.email} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-primary">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate">{result.email}</p>
                        {result.name && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{result.name}</p>}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${result.status === "conflict" || result.status === "invalid" || result.status === "already_facilitator" ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {t(`pmMisc.facilitators.inviteStatus_${result.status}`) || result.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {inviteResults && (
                <div className="space-y-2">
                  {inviteResults.map((result) => (
                    <div key={result.email} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border-primary)] bg-primary">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate">{result.name || result.email}</p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">{result.email}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded ${result.status === "invited" || result.status === "activation_sent" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {t(`pmMisc.facilitators.inviteStatus_${result.status}`) || result.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowInviteModal(false)} className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                  {t("pmMisc.facilitators.cancel")}
                </button>
                {!inviteResults && (
                  <button
                    onClick={handleInviteAll}
                    disabled={inviting || !parseInviteEmails().length}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-wide disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.inviteAll")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
