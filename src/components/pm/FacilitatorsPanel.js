"use client";

import { useState } from "react";
import {
  ChevronLeft,
  UserCheck,
  ShieldCheck,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { FULL_FACILITATOR_PERMISSIONS } from "./facilitators-panel/capabilities";
import {
  AddFacilitatorSection,
  AssignedFacilitatorsSection,
  DefaultPermissionsSection,
  FacilitatorReviewsSection,
  LeadFacilitatorSection,
  ParticipantScopeSection,
} from "./facilitators-panel/FacilitatorsSections";
import InviteFacilitatorsModal from "./facilitators-panel/InviteFacilitatorsModal";

/**
 * PM — PROGRAM FACILITATORS
 * The program's system-defined Facilitators group. The system maintains the
 * group; the PM manages the people inside it: search any contact by name or
 * email, invite people without accounts, configure program-level permissions,
 * participant scope, individual overrides, lead facilitator per participant
 * group, and facilitator reviews (with PM decisions).
 */

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

        <AddFacilitatorSection
          t={t}
          search={search}
          setSearch={setSearch}
          busy={busy}
          filteredPool={filteredPool}
          onAdd={addFacilitator}
          conflictError={conflictError}
          programName={program?.name}
          programId={id}
        />

        <ParticipantScopeSection
          t={t}
          scope={program.facilitator_scope}
          onChange={saveProgramConfig}
        />

        <DefaultPermissionsSection
          t={t}
          defaultPerms={defaultPerms}
          onToggle={toggleDefault}
        />

        <AssignedFacilitatorsSection
          t={t}
          facilitators={program.facilitators || []}
          onRemove={removeFacilitator}
          onToggleOverride={toggleOverride}
        />

        <LeadFacilitatorSection
          t={t}
          families={families}
          facilitators={program.facilitators || []}
          onSetLead={setLead}
        />

        <FacilitatorReviewsSection
          t={t}
          reviews={reviews}
          decisionInputs={decisionInputs}
          onNoteChange={(reviewId, value) =>
            setDecisionInputs({
              ...decisionInputs,
              [reviewId]: { ...decisionInputs[reviewId], note: value },
            })
          }
          onDecision={recordDecision}
        />

        {/* Invite Facilitators modal */}
        {showInviteModal && (
          <InviteFacilitatorsModal
            t={t}
            emailCount={parseInviteEmails().length}
            inviteEmails={inviteEmails}
            setInviteEmails={setInviteEmails}
            invitePreview={invitePreview}
            inviteResults={inviteResults}
            previewing={previewing}
            inviting={inviting}
            onPreview={handlePreviewInvites}
            onInviteAll={handleInviteAll}
            onClose={() => setShowInviteModal(false)}
          />
        )}
    </div>
  );
}
